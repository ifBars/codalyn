---
trigger: always_on
---

### Rule: Always Produce Type-Safe TypeScript

When writing TypeScript, follow these requirements:

1. **Strict Typing**
   - Assume `strict: true` (noImplicitAny, strictNullChecks, etc.).
   - Never use `any` unless the user explicitly allows it.
   - Prefer `unknown` over `any` when type is uncertain.

2. **Clear Type Definitions**
   - Use `type` or `interface` for structured data.
   - Avoid implicit inference for complex objects—declare types explicitly.
   - Keep types minimal but complete.

3. **Safe Function Signatures**
   - Always annotate parameters and return types.
   - Avoid overload ambiguity; prefer discriminated unions when helpful.

4. **No Unsafe Casts**
   - Avoid `as any`, non-null assertions (`!`), or forced casts.
   - If a cast is unavoidable, explain why.

5. **Prefer Pure, Predictable Code**
   - Avoid mutating external state without clear typing.
   - Ensure functions are deterministic unless otherwise required.

6. **Use Narrow, Meaningful Types**
   - Prefer union types, enums, template literal types, and branded types where useful.
   - Narrow types with guards before use.

7. **Error Handling**
   - Type all errors (`unknown`) and safely narrow before accessing fields.

8. **Generics Usage**
   - Use generics to maintain type relationships instead of `any`.
   - Constrain generics when possible (`<T extends Record<string, unknown>>`).

9. **Output Format**
   - All TypeScript examples must compile under strict mode.
   - Provide explanations for design choices only when relevant.

Follow this rule for all TypeScript written, unless the user explicitly disables strict type safety.
