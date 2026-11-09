const shell = (title: string, body: string) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><meta name="referrer" content="no-referrer">
<title>${title}</title>
<style>body{font-family:system-ui,sans-serif;max-width:32rem;margin:15vh auto;padding:0 1.25rem;line-height:1.5;color:#222}
@media(prefers-color-scheme:dark){body{background:#111;color:#eee}}</style></head>
<body>${body}</body></html>`;

export const invalidLinkPage = () =>
  shell(
    'Link not valid',
    `<h1>This link isn't valid anymore</h1>
<p>Ask your choir director for a new one.</p>`,
  );

export const serverErrorPage = () =>
  shell(
    'Something went wrong',
    `<h1>Something went wrong</h1><p>Please try again in a minute.</p>`,
  );
