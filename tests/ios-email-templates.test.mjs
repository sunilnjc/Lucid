import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const token = "{{ .Token }}";
const templates = ["sign-in.html", "confirm-sign-up.html"];
const load = (name) => readFileSync(new URL(`../supabase/templates/${name}`, import.meta.url), "utf8");
const css = (style, property) => style.match(new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+)`, "i"))?.[1].trim();
const styleOf = (attributes) => attributes.match(/\bstyle="([^"]+)"/i)?.[1] ?? "";

function luminance(hex) {
  assert.match(hex ?? "", /^#[\da-f]{6}$/i, "Use explicit six-digit colours for contrast checks");
  const rgb = hex.slice(1).match(/../g).map((channel) => {
    const value = parseInt(channel, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}

function contrast(foreground, background) {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

function horizontalPadding(style) {
  const values = (css(style, "padding") ?? "").split(/\s+/);
  assert.ok(values.length >= 1 && values.length <= 4 && values.every((value) => /^\d+(?:\.\d+)?px$/.test(value)));
  const pixels = values.map(parseFloat);
  return pixels.length === 1 ? pixels[0] * 2 : pixels[1] + (pixels[3] ?? pixels[1]);
}

// A contract for these curated templates, not a general-purpose HTML sanitizer.
function validateTemplate(html) {
  assert.equal(html.split(token).length - 1, 1, "Include the literal Token placeholder exactly once");
  assert.doesNotMatch(html.replace(token, ""), /\{\{|\}\}/, "Do not include other template variables");
  assert.doesNotMatch(html, /ConfirmationURL|TokenHash|SiteURL|RedirectTo/i);
  assert.doesNotMatch(html, /<(?:a|area|base|link|img|svg|image|video|audio|source|track|iframe|frame|object|embed|script|form|input|button)\b/i, "Native code emails must not contain links, assets or interactive elements");
  assert.doesNotMatch(html, /\b(?:href|src|srcset|action|formaction|poster|background|ping|on[a-z]+)\s*=/i);
  assert.doesNotMatch(html, /\b(?:https?|ftp|mailto|tel|data|javascript):|url\s*\(|@import|http-equiv/i, "Do not load or navigate to any external resource");
  assert.doesNotMatch(html, /job[\s-]*(?:pursuit|search[\s-]*agent)/i, "Remove reference-product branding");
  assert.doesNotMatch(html, /\b(?:\d+|one|two|five|ten|fifteen|twenty|thirty|sixty|an?)\s+(?:seconds?|minutes?|hours?|days?)\b/i, "Do not hard-code expiry durations");

  const text = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
  assert.match(text, /\bLucid\b/);
  assert.match(text, /Open (?:Lucid|the app) and enter this one-time code/i, "Direct users back to the native app");
  assert.match(text, /If the code has expired, request a new one in Lucid\./i);
  assert.match(text, /Never share this code or forward this email\./i);
  assert.match(text, /If you didn[’']t request this email, you can ignore it\./i);

  assert.match(html, /<html\b[^>]*\blang="en"/i);
  assert.match(html, /<meta\b[^>]*name="viewport"[^>]*width=device-width/i);
  assert.match(html, /<table\b[^>]*role="presentation"/i);
  assert.match(html, /width:100%;max-width:560px/i, "Keep the email fluid on narrow screens");
  assert.doesNotMatch(html, /user-scalable\s*=\s*no|maximum-scale\s*=\s*1/i, "Do not block text zoom");
  assert.equal((html.match(/<h1\b/gi) ?? []).length, 1, "Provide one main heading");

  const code = html.match(/<p\b([^>]*)>\s*\{\{ \.Token \}\}\s*<\/p>/i);
  assert.ok(code, "Keep the code as one uninterrupted, selectable text node");
  const codeStyle = styleOf(code[1]);
  assert.match(css(codeStyle, "font-family") ?? "", /monospace/i);
  assert.match(css(codeStyle, "font-size") ?? "", /px$/);
  const codeSize = parseFloat(css(codeStyle, "font-size"));
  const codeSpacing = parseFloat(css(codeStyle, "letter-spacing"));
  assert.ok(codeSize >= 28 && codeSize <= 36, "Keep code text readable without oversizing it on phones");
  assert.ok(codeSpacing >= 0 && codeSpacing <= 4, "Keep code spacing readable without excessive width");
  assert.doesNotMatch(codeStyle, /display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0(?:\D|$)/i);
  assert.ok(contrast(css(codeStyle, "color"), css(codeStyle, "background")) >= 4.5, "The code needs at least 4.5:1 source contrast");
  const bodyStyle = styleOf(html.match(/<body\b([^>]*)>/i)?.[1] ?? "");
  assert.ok(contrast(css(bodyStyle, "color"), css(bodyStyle, "background")) >= 4.5);
  assert.ok(contrast(css(bodyStyle, "color"), "#ffffff") >= 4.5);

  // Budget a maximum-length native OTP at a 320px viewport. This is a source
  // estimate using 0.625em per monospace digit, not a client-rendering guarantee.
  const cell = [...html.matchAll(/<td\b([^>]*)>([\s\S]*?)<\/td>/gi)].find((match) => match[2].includes(token));
  assert.ok(cell, "The code must be inside the email content cell");
  const availableWidth = 320 - horizontalPadding(bodyStyle) - horizontalPadding(styleOf(cell[1]))
    - horizontalPadding(codeStyle) - 2 * parseFloat(css(codeStyle, "border"));
  const estimatedCodeWidth = 10 * (codeSize * 0.625 + codeSpacing);
  assert.ok(estimatedCodeWidth <= availableWidth, `A 10-digit code needs about ${estimatedCodeWidth}px but only ${availableWidth}px is available`);
  assert.equal(css(codeStyle, "word-break"), "break-all", "Allow a defensive wrap at larger text sizes or narrower widths");
  assert.notEqual(css(codeStyle, "white-space"), "nowrap");
}

for (const name of templates) {
  test(`${name}: native OTP-only content, responsive semantics and readable code`, () => {
    validateTemplate(load(name));
  });
}

test("the contract rejects representative unsafe or confusing regressions", () => {
  const original = load("sign-in.html");
  const mutations = [
    ["duplicate code", (html) => html.replace(token, token + token)],
    ["other Supabase variable", (html) => html.replace(token, "{{ .ConfirmationURL }}")],
    ["additional Supabase variable", (html) => html.replace(token, token + "{{ .SiteURL }}")],
    ["sign-in link", (html) => html.replace("</body>", '<a href="https://example.invalid">Sign in</a></body>')],
    ["remote pixel", (html) => html.replace("</body>", '<img src="https://example.invalid/pixel"></body>')],
    ["old branding", (html) => html.replace("Lucid", "The Job Pursuit")],
    ["tiny code", (html) => html.replace("font-size:32px", "font-size:12px")],
    ["ten-digit code overflow", (html) => html.replace("letter-spacing:1px;line-height:1.4", "letter-spacing:4px;line-height:1.4")],
    ["missing narrow-screen wrap", (html) => html.replace("word-break:break-all;", "")],
    ["low-contrast code", (html) => html.replace("color:#092c2b;font-family", "color:#edf5f1;font-family")],
    ["missing app instruction", (html) => html.replace("Open Lucid and enter this one-time code", "Continue now")],
    ["missing ignore instruction", (html) => html.replace("If you didn’t request this email, you can ignore it.", "")],
    ["hard-coded expiry", (html) => html.replace("If the code has expired", "After ten minutes")],
  ];
  for (const [name, mutate] of mutations) {
    assert.throws(() => validateTemplate(mutate(original)), { name: "AssertionError" }, name);
  }
});
