from typing import Dict, Any, Callable, List, Optional
from jinja2 import Template

from core.workflow.schemas.plan_schema import Plan, ToolStep, IfStep, LoopStep, Condition, SimpleCondition, ComparisonCondition, LogicalCondition
from core.workflow.tools.base import Tool


class ExecutionContext:
    """Manages variable storage and scoping during plan execution."""
    def __init__(self, initial_variables: Optional[Dict[str, Any]] = None):
        self._scopes: List[Dict[str, Any]] = []
        self._global_scope = initial_variables or {}
        self._scopes.append(self._global_scope)
    
    def get_variable(self, name: str) -> Any:
        """Get variable value, checking scopes from innermost to outermost."""
        for scope in reversed(self._scopes):
            if name in scope:
                return scope[name]
        raise KeyError(f"Variable '{name}' not found in any scope")
    
    def set_variable(self, name: str, value: Any) -> None:
        """Set variable in the current (innermost) scope."""
        self._scopes[-1][name] = value
    
    def has_variable(self, name: str) -> bool:
        """Check if variable exists in any scope."""
        for scope in reversed(self._scopes):
            if name in scope:
                return True
        return False
    
    def push_scope(self, scope_vars: Optional[Dict[str, Any]] = None) -> None:
        """Create a new scope (for loops, conditionals)."""
        new_scope = scope_vars or {}
        self._scopes.append(new_scope)
    
    def pop_scope(self) -> Dict[str, Any]:
        """Remove the current scope and return its variables."""
        if len(self._scopes) <= 1:
            raise RuntimeError("Cannot pop global scope")
        return self._scopes.pop()
    
    def get_all_variables(self) -> Dict[str, Any]:
        """Get all variables from all scopes (for template rendering)."""
        result = {}
        for scope in self._scopes:
            result.update(scope)
        
        # Add built-in functions for Jinja templates
        result.update({
            'len': len,
            'str': str,
            'int': int,
            'float': float,
            'bool': bool,
            'list': list,
            'dict': dict,
            'set': set,
            'tuple': tuple,
            'min': min,
            'max': max,
            'sum': sum,
            'abs': abs,
            'round': round,
        })
        
        return result
    
    def resolve_template(self, template_str: str) -> Any:
        """Resolve Jinja2 template expressions like {{variable}} or {{list[0]}}."""
        if not isinstance(template_str, str):
            return template_str

        # Handle direct variable references and expressions
        if not template_str.strip().startswith('{{'):
            # Check if it's a simple function call, slice expression, or other expression that should be evaluated
            if (any(func in template_str for func in ['len(', 'sum(', 'max(', 'min(', 'abs(']) or 
                ('[' in template_str and ':' in template_str)):
                # Wrap in Jinja2 template syntax for evaluation
                template_str = '{{ ' + template_str + ' }}'
            else:
                return template_str
        
        template = Template(template_str)   
        result = template.render(self.get_all_variables())
        
        # If the template result looks like a list string representation, try to evaluate it
        if (isinstance(result, str) and 
            result.strip().startswith('[') and result.strip().endswith(']')):
            try:
                # Use ast.literal_eval for safe evaluation of literal expressions
                import ast
                actual_result = ast.literal_eval(result)
                return actual_result
            except (ValueError, SyntaxError):
                return result
        
        return result


def resolve_pydantic_inputs(inputs: Any, context: ExecutionContext) -> Any:
    """Resolve template expressions in Pydantic model fields."""
    if hasattr(inputs, 'dict'):  # It's a Pydantic model
        # Get the raw dictionary
        input_dict = inputs.dict()
        
        # Resolve each field
        resolved_dict = {}
        for key, value in input_dict.items():
            if isinstance(value, str):
                resolved_dict[key] = context.resolve_template(value)
            elif isinstance(value, list):
                resolved_dict[key] = [context.resolve_template(item) if isinstance(item, str) else item for item in value]
            else:
                resolved_dict[key] = value
        
        # Create new model instance with resolved values
        return type(inputs)(**resolved_dict)
    
    return inputs


def evaluate_simple_condition(condition: SimpleCondition, context: ExecutionContext) -> bool:
    """Evaluate a simple condition expression."""
    expression = condition.expression
    
    if expression == "true":
        return True
    elif expression == "false":
        return False
    
    # Resolve template expressions first
    resolved = context.resolve_template(expression)
    
    # If it's already a boolean, return it
    if isinstance(resolved, bool):
        return resolved
    
    # If it's a non-empty string/list/dict, it's truthy
    if resolved:
        return True
    
    return False


def evaluate_comparison_condition(condition: ComparisonCondition, context: ExecutionContext) -> bool:
    """Evaluate a comparison condition."""
    # Resolve left operand
    left_value = context.resolve_template(condition.left)
    
    # Resolve right operand if it's a string template
    right_value = condition.right
    if isinstance(right_value, str):
        right_value = context.resolve_template(right_value)
    
    # Perform comparison based on operator
    if condition.operator == "==":
        return left_value == right_value
    elif condition.operator == "!=":
        return left_value != right_value
    elif condition.operator == "<":
        return left_value < right_value
    elif condition.operator == "<=":
        return left_value <= right_value
    elif condition.operator == ">":
        return left_value > right_value
    elif condition.operator == ">=":
        return left_value >= right_value
    elif condition.operator == "in":
        return left_value in right_value
    elif condition.operator == "not in":
        return left_value not in right_value
    else:
        raise ValueError(f"Unknown comparison operator: {condition.operator}")


def evaluate_logical_condition(condition: LogicalCondition, context: ExecutionContext) -> bool:
    """Evaluate a logical condition."""
    if condition.operator == "and":
        return all(evaluate_condition(cond, context) for cond in condition.conditions)
    elif condition.operator == "or":
        return any(evaluate_condition(cond, context) for cond in condition.conditions)
    elif condition.operator == "not":
        if len(condition.conditions) != 1:
            raise ValueError("NOT operator requires exactly one condition")
        return not evaluate_condition(condition.conditions[0], context)
    else:
        raise ValueError(f"Unknown logical operator: {condition.operator}")


def evaluate_condition(condition: Condition, context: ExecutionContext) -> bool:
    """Evaluate any type of condition."""
    if isinstance(condition, SimpleCondition):
        return evaluate_simple_condition(condition, context)
    elif isinstance(condition, ComparisonCondition):
        return evaluate_comparison_condition(condition, context)
    elif isinstance(condition, LogicalCondition):
        return evaluate_logical_condition(condition, context)
    else:
        raise ValueError(f"Unknown condition type: {type(condition)}")


def execute_tool_step(step: ToolStep, tools: Dict[str, Tool], context: ExecutionContext) -> Any:
    """Execute a tool step with template resolution."""
    print(f"Executing tool step: {step.tool}")
    
    tool = tools[step.tool]
    resolved_inputs = resolve_pydantic_inputs(step.inputs, context)

    print('resolved tool inputs:')
    print(resolved_inputs)
    tool_result = tool(resolved_inputs)
    
    # Store result in context
    context.set_variable(step.output, tool_result)
    print(f"Tool result stored in '{step.output}': {tool_result}")
    
    return tool_result


def execute_if_step(step: IfStep, tools: Dict[str, Tool], context: ExecutionContext) -> Any:
    """Execute an if step with condition evaluation."""
    print(f"Executing if step with condition: {step.condition}")
    
    condition_result = evaluate_condition(step.condition, context)
    print(f"Condition evaluated to: {condition_result}")
    
    if condition_result:
        return execute_step(step.then, tools, context)
    
    return None


def execute_loop_step(step: LoopStep, tools: Dict[str, Tool], context: ExecutionContext) -> Any:
    """Execute a loop step with scoped iteration."""
    print(f"Executing loop step: {step.for_var} in {step.in_expr}")
    
    # Resolve the iterable expression
    print(step.in_expr)
    print(type(step.in_expr))
    iterable = context.resolve_template(step.in_expr)
    if not isinstance(iterable, list):
        raise ValueError(f"Loop 'in' expression must resolve to a list, got: {type(iterable)}")
    
    results = {}
    
    for item in iterable:
        # Create new scope for loop iteration
        context.push_scope({step.for_var: item})
        
        try:
            # Execute all steps in the loop body
            for body_step in step.body:
                execute_step(body_step, tools, context)
            
            # Collect results from this iteration
            if step.output_dict:
                # Store the loop variable value as key and collect outputs
                results[str(item)] = context.get_all_variables()
        
        finally:
            # Always pop the loop scope
            context.pop_scope()
    
    # Store the collected results
    context.set_variable(step.output_dict, results)
    print(f"Loop results stored in '{step.output_dict}': {results}")
    
    return results


def execute_step(step: Any, tools: Dict[str, Tool], context: ExecutionContext) -> Any:
    """Execute a single step based on its type."""
    if step.type == "tool":
        return execute_tool_step(step, tools, context)
    elif step.type == "if":
        return execute_if_step(step, tools, context)
    elif step.type == "loop":
        return execute_loop_step(step, tools, context)
    else:
        raise ValueError(f"Unknown step type: {step.type}")


def execute_plan(plan: Plan, tools: Dict[str, Tool], initial_context: Optional[Dict[str, Any]] = None):
    """Execute a complete plan with proper context management."""
    # Convert tools list to dictionary for easier lookup
    tools_dict = {tool.name: tool for tool in tools}
    print('\n')

    # Initialize execution context
    context = ExecutionContext(initial_context)
    
    print(f"Starting plan execution with {len(plan.steps)} steps")
    
    for step in plan.steps:
        print(f"\n--- Executing step: {step.id} ---")
        print(f'\nStep details:\n{step}\n')
        try:
            execute_step(step, tools_dict, context)
        except Exception as e:
            print(f"Error executing step {step.id}: {e}")
            raise
    
    print("\nPlan execution completed")
    return context.get_all_variables()
