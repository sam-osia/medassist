from core.llm_lib.supervisor_worker_network.schemas.plan_schema import Plan

def print_plan(plan: Plan, indent=0):
    """Format the plan as a string in a nice nested format"""
    output_lines = []
    
    def format_step(step, indent_level):
        indent_str = "  " * indent_level
        
        if step.type == "tool":
            output_lines.append(f"{indent_str}=' Tool: {step.tool} (id: {step.id})")
            output_lines.append(f"{indent_str}   Summary: {step.step_summary}")
            output_lines.append(f"{indent_str}   Output: {step.output}")
            if hasattr(step.inputs, '__dict__'):
                inputs_dict = step.inputs.__dict__
            else:
                inputs_dict = step.inputs
            for key, value in inputs_dict.items():
                output_lines.append(f"{indent_str}   {key}: {value}")
        
        elif step.type == "if":
            output_lines.append(f"{indent_str}S If (id: {step.id})")
            output_lines.append(f"{indent_str}   Summary: {step.step_summary}")
            condition_str = _format_condition(step.condition)
            output_lines.append(f"{indent_str}   Condition: {condition_str}")
            output_lines.append(f"{indent_str}   Then:")
            format_step(step.then, indent_level + 2)
        
        elif step.type == "loop":
            output_lines.append(f"{indent_str}   Loop (id: {step.id})")
            output_lines.append(f"{indent_str}   Summary: {step.step_summary}")
            output_lines.append(f"{indent_str}   For: {step.for_var} in {step.in_expr}")
            output_lines.append(f"{indent_str}   Output: {step.output_dict}")
            output_lines.append(f"{indent_str}   Body:")
            for body_step in step.body:
                format_step(body_step, indent_level + 2)
        
        elif step.type == "flag_variable":
            output_lines.append(f"{indent_str}<� Flag Variable (id: {step.id})")
            output_lines.append(f"{indent_str}   Summary: {step.step_summary}")
            output_lines.append(f"{indent_str}   Variable: {step.variable}")
            output_lines.append(f"{indent_str}   Value: {step.value}")
    
    def _format_condition(condition):
        if isinstance(condition, str):
            return condition
        elif hasattr(condition, 'type'):
            if condition.type == "expression":
                return condition.expression
            elif condition.type == "comparison":
                return f"{condition.left} {condition.operator} {condition.right}"
            elif condition.type == "logical":
                sub_conditions = [_format_condition(c) for c in condition.conditions]
                return f" {condition.operator} ".join(sub_conditions)
        return str(condition)
    
    output_lines.append("=� Execution Plan:")
    output_lines.append("=" * 50)
    for i, step in enumerate(plan.steps):
        output_lines.append(f"\nStep {i+1}:")
        format_step(step, 1)
    output_lines.append("=" * 50)
    
    return "\n".join(output_lines)