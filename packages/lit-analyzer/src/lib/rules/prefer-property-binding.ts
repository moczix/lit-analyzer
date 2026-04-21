import { LIT_HTML_PROP_ATTRIBUTE_MODIFIER } from "../analyze/constants.js";
import { HtmlProp } from "../analyze/parse/parse-html-data/html-tag.js";
import { HtmlNodeAttrAssignmentKind } from "../analyze/types/html-node/html-node-attr-assignment-types.js";
import { HtmlNodeAttr, HtmlNodeAttrKind } from "../analyze/types/html-node/html-node-attr-types.js";
import { HtmlNodeKind } from "../analyze/types/html-node/html-node-types.js";
import { RuleFix } from "../analyze/types/rule/rule-fix.js";
import { RuleModule } from "../analyze/types/rule/rule-module.js";
import { RuleModuleContext } from "../analyze/types/rule/rule-module-context.js";
import { getNodeIdentifier } from "../analyze/util/ast-util.js";
import { isCustomElementTagName } from "../analyze/util/is-valid-name.js";
import { documentRangeToSFRange, rangeFromHtmlNodeAttr } from "../analyze/util/range-util.js";

/**
 * Suggests using Lit property bindings (`.prop=${...}`) instead of attribute bindings (`prop="..."`)
 * only for Lit reactive properties (`@property` / `static properties`), not for other analyzer members
 * (e.g. ad-hoc fields or DOM-like names without Lit `meta`).
 */
const rule: RuleModule = {
	id: "prefer-property-binding",
	meta: {
		priority: "low"
	},
	visitHtmlAttribute(htmlAttr: HtmlNodeAttr, context) {
		const { htmlStore } = context;

		if (htmlAttr.htmlNode.kind !== HtmlNodeKind.NODE) return;

		if (htmlAttr.kind !== HtmlNodeAttrKind.ATTRIBUTE) return;

		if (!isCustomElementTagName(htmlAttr.htmlNode.tagName)) return;

		const htmlTag = htmlStore.getHtmlTag(htmlAttr.htmlNode);
		if (htmlTag == null || htmlTag.builtIn) return;

		const prop = htmlTag.properties.find(p => p.name.toLowerCase() === htmlAttr.name.toLowerCase());
		if (prop == null || !isLitReactivePublicProperty(prop, context)) return;

		const { assignment } = htmlAttr;
		if (assignment == null) return;
		if (assignment.kind === HtmlNodeAttrAssignmentKind.ELEMENT_EXPRESSION) return;

		const fix = makeFix(htmlAttr);
		context.report({
			location: rangeFromHtmlNodeAttr(htmlAttr),
			message: `Use property binding '${LIT_HTML_PROP_ATTRIBUTE_MODIFIER}${htmlAttr.name}' instead of attribute '${htmlAttr.name}' for stronger TypeScript checking.`,
			fixMessage: `Change to '${LIT_HTML_PROP_ATTRIBUTE_MODIFIER}${htmlAttr.name}'`,
			...(fix != null ? { fix: () => fix } : {})
		});
	}
};

export default rule;

/**
 * True when this HTML prop comes from Lit's `@property` / `static properties` (web-component-analyzer `meta`),
 * excluding `@internalProperty` and `@state`.
 */
function isLitReactivePublicProperty(prop: HtmlProp, context: RuleModuleContext): boolean {
	const member = prop.declaration;
	if (member == null || member.kind !== "property" || member.meta == null) {
		return false;
	}

	const decorator = member.meta.node?.decorator;
	if (decorator == null) {
		// Lit `static properties` / config without a per-field decorator
		return true;
	}

	const decoratorId = getNodeIdentifier(decorator, context.ts);
	if (decoratorId == null) {
		return true;
	}

	const decoratorName = decoratorId.text;
	return decoratorName !== "internalProperty" && decoratorName !== "state";
}

function makeFix(htmlAttr: HtmlNodeAttr): RuleFix | undefined {
	const assignment = htmlAttr.assignment;
	if (assignment == null) return undefined;

	switch (assignment.kind) {
		case HtmlNodeAttrAssignmentKind.EXPRESSION:
			return {
				message: `Use '${LIT_HTML_PROP_ATTRIBUTE_MODIFIER}' modifier`,
				actions: [
					{
						kind: "changeAttributeModifier",
						htmlAttr,
						newModifier: LIT_HTML_PROP_ATTRIBUTE_MODIFIER
					}
				]
			};

		case HtmlNodeAttrAssignmentKind.STRING: {
			const newText = `.${htmlAttr.name}=${JSON.stringify(assignment.value)}`;
			return {
				message: `Use property binding`,
				actions: [
					{
						kind: "changeRange",
						range: documentRangeToSFRange(htmlAttr.document, {
							start: htmlAttr.location.start,
							end: htmlAttr.location.end
						}),
						newText
					}
				]
			};
		}

		default:
			return undefined;
	}
}
