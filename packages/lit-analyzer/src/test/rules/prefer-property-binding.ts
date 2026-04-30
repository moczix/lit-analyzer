import { getDiagnostics } from "../helpers/analyze.js";
import { hasDiagnostic, hasNoDiagnostics } from "../helpers/assert.js";
import { makeElement } from "../helpers/generate-test-file.js";
import { tsTest } from "../helpers/ts-test.js";

tsTest("prefer-property-binding is off by default", t => {
	const { diagnostics } = getDiagnostics([makeElement({ properties: ["kind: string"] }), 'html`<my-element kind="dropdown"></my-element>`']);
	hasNoDiagnostics(t, diagnostics);
});

tsTest("Reports attribute binding when the same name is declared as a property on a custom element", t => {
	const { diagnostics } = getDiagnostics([makeElement({ properties: ["kind: string"] }), 'html`<my-element kind="dropdown"></my-element>`'], {
		rules: { "prefer-property-binding": true }
	});
	hasDiagnostic(t, diagnostics, "prefer-property-binding");
});

tsTest("Does not report property binding", t => {
	const { diagnostics } = getDiagnostics([makeElement({ properties: ["kind: string"] }), 'html`<my-element .kind="${"dropdown"}"></my-element>`'], {
		rules: { "prefer-property-binding": true }
	});
	hasNoDiagnostics(t, diagnostics);
});

tsTest("Reports attribute binding with interpolated expression", t => {
	const { diagnostics } = getDiagnostics([makeElement({ properties: ["kind: string"] }), 'html`<my-element kind="${x}"></my-element>`'], {
		rules: { "prefer-property-binding": true }
	});
	hasDiagnostic(t, diagnostics, "prefer-property-binding");
});

tsTest("Does not report built-in elements", t => {
	const { diagnostics } = getDiagnostics('html`<input type="text" />`', {
		rules: { "prefer-property-binding": true }
	});
	hasNoDiagnostics(t, diagnostics);
});

tsTest("Does not report unknown custom element tags", t => {
	const { diagnostics } = getDiagnostics('html`<x-unknown kind="a"></x-unknown>`', {
		rules: { "prefer-property-binding": true, "no-unknown-tag-name": false }
	});
	hasNoDiagnostics(t, diagnostics);
});

tsTest("Does not report attribute binding for a plain class field without Lit @property meta", t => {
	const { diagnostics } = getDiagnostics(
		[
			{
				fileName: "bare-el.ts",
				text: `
				class BareEl extends HTMLElement {
					plain = "";
				}
				customElements.define("bare-el", BareEl);
				`
			},
			{
				fileName: "main.ts",
				entry: true,
				text: `import "./bare-el.js"; html\`<bare-el plain="x"></bare-el>\`;`
			}
		],
		{ rules: { "prefer-property-binding": true } }
	);
	hasNoDiagnostics(t, diagnostics);
});

tsTest("Ignores spec files by default", t => {
	const { diagnostics } = getDiagnostics(
		[
			makeElement({ properties: ["kind: string"] }),
			{
				fileName: "main.spec.ts",
				entry: true,
				text: `import "./my-element.js"; html\`<my-element kind="dropdown"></my-element>\`;`
			}
		],
		{ rules: { "prefer-property-binding": true } }
	);
	hasNoDiagnostics(t, diagnostics);
});

tsTest("Can include spec files when ignoreFiles is empty", t => {
	const { diagnostics } = getDiagnostics(
		[
			makeElement({ properties: ["kind: string"] }),
			{
				fileName: "main.spec.ts",
				entry: true,
				text: `import "./my-element.js"; html\`<my-element kind="dropdown"></my-element>\`;`
			}
		],
		{
			rules: { "prefer-property-binding": true },
			preferPropertyBinding: { ignoreFiles: [] }
		}
	);
	hasDiagnostic(t, diagnostics, "prefer-property-binding");
});

tsTest("Does not report attribute binding when the value uses ifDefined", t => {
	const { diagnostics } = getDiagnostics(
		[
			makeElement({ properties: ["kind: string"] }),
			{
				fileName: "main.ts",
				entry: true,
				text: `
				import "./my-element.js";
				type ifDefined = Function;
				const x: string | undefined = "a";
				html\`<my-element kind="\${ifDefined(x)}"></my-element>\`;
				`
			}
		],
		{ rules: { "prefer-property-binding": true } }
	);
	hasNoDiagnostics(t, diagnostics);
});

tsTest("Does not report attribute binding when the value uses classMap on class", t => {
	const { diagnostics } = getDiagnostics(
		[
			makeElement({ properties: ["class: string"] }),
			{
				fileName: "main.ts",
				entry: true,
				text: `
				import "./my-element.js";
				type classMap = Function;
				html\`<my-element class="\${classMap({ a: true })}"></my-element>\`;
				`
			}
		],
		{ rules: { "prefer-property-binding": true } }
	);
	hasNoDiagnostics(t, diagnostics);
});

tsTest("Does not report attribute binding when the value uses styleMap on style", t => {
	const { diagnostics } = getDiagnostics(
		[
			makeElement({ properties: ["style: string"] }),
			{
				fileName: "main.ts",
				entry: true,
				text: `
				import "./my-element.js";
				type styleMap = Function;
				html\`<my-element style="\${styleMap({ color: "red" })}"></my-element>\`;
				`
			}
		],
		{ rules: { "prefer-property-binding": true } }
	);
	hasNoDiagnostics(t, diagnostics);
});
