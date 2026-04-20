import { LIT_HTML_PROP_ATTRIBUTE_MODIFIER } from "../analyze/constants.js";
import { HtmlNodeAttrAssignmentKind } from "../analyze/types/html-node/html-node-attr-assignment-types.js";
import { HtmlNodeAttr, HtmlNodeAttrKind } from "../analyze/types/html-node/html-node-attr-types.js";
import { HtmlNodeKind } from "../analyze/types/html-node/html-node-types.js";
import { RuleFix } from "../analyze/types/rule/rule-fix.js";
import { RuleModule } from "../analyze/types/rule/rule-module.js";
import { isCustomElementTagName } from "../analyze/util/is-valid-name.js";
import { documentRangeToSFRange, rangeFromHtmlNodeAttr } from "../analyze/util/range-util.js";

/**
 * Suggests using Lit property bindings (`.prop=${...}`) instead of attribute bindings (`prop="..."`)
 * for members declared on a custom element class, so values flow through TypeScript as expressions.
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
		if (prop == null) return;

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
