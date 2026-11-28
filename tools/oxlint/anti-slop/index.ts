import { eslintCompatPlugin } from "@oxlint/plugins";
import { noChainedTypeAssertionsRule } from "./rules/no-chained-type-assertions.ts";
import { requireSafetyCommentForTypeAssertionRule } from "./rules/require-safety-comment-for-type-assertion.ts";
import { noManualEffectErrorTagRule } from "./effect/rules/no-manual-effect-error-tag.ts";
import { noManualTagComparisonRule } from "./effect/rules/no-manual-tag-comparison.ts";
import { noManualTaggedConstructionRule } from "./effect/rules/no-manual-tagged-construction.ts";
import { noServiceConstructorImportsRule } from "./effect/rules/no-service-constructor-imports.ts";
import { preferEffectMatchRule } from "./effect/rules/prefer-effect-match.ts";

export default eslintCompatPlugin({
  meta: {
    name: "anti-slop",
  },
  rules: {
    "no-chained-type-assertions": noChainedTypeAssertionsRule,
    "require-safety-comment-for-type-assertion": requireSafetyCommentForTypeAssertionRule,
    "no-manual-effect-error-tag": noManualEffectErrorTagRule,
    "no-manual-tag-comparison": noManualTagComparisonRule,
    "no-manual-tagged-construction": noManualTaggedConstructionRule,
    "no-service-constructor-imports": noServiceConstructorImportsRule,
    "prefer-effect-match": preferEffectMatchRule,
  },
});
