'use strict';
const icons={
home:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
id:'<rect x="3" y="5" width="18" height="14" rx="3"/><circle cx="8" cy="10" r="2"/><path d="M5 16c0-3 6-3 6 0m3-6h4m-4 4h4"/>',
edit:'<path d="m15 4 5 5M4 20l4-1L21 6l-4-4L4 15zM12 20h9"/>',
chart:'<path d="M4 3v18h17M8 16v-4m5 4V8m5 8V4"/>',
award:'<circle cx="12" cy="8" r="5"/><path d="m8 12-1 9 5-3 5 3-1-9"/>',
activity:'<path d="M3 12h4l3-8 4 16 3-8h4"/>',
book:'<path d="M12 5C8 2 4 3 2 4v15c4-2 7-1 10 1 3-2 6-3 10-1V4c-4-2-7-1-10 1v15"/>',
cert:'<path d="M14 3H5v18h14V8zM14 3v5h5M8 11h4m-4 4h3"/><circle cx="15" cy="16" r="2"/><path d="m14 18-1 3 2-1 2 1-1-3"/>',
shield:'<path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6z"/><path d="m8 12 3 3 5-6"/>',
out:'<path d="M10 4H4v16h6m4-12 4 4-4 4m-6-4h13"/>',
arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',
chevron:'<path d="m9 5 7 7-7 7"/>',
menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
close:'<path d="m6 6 12 12M6 18 18 6"/>',
lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/>',
check:'<path d="m5 12 4 4L19 6"/>',
star:'<path d="m12 3 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z"/>',
chat:'<path d="M21 11a8 8 0 0 1-8 8H7l-5 3 2-6a8 8 0 1 1 17-5Z"/><path d="M7 10h9m-9 4h5"/>',
download:'<path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4"/>',
info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/>',
globe:'<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',
device:'<rect x="5" y="2" width="14" height="20" rx="3"/><path d="M10 18h4"/>',
qr:'<path d="M3 3h6v6H3zM15 3h6v6h-6zM3 15h6v6H3zM12 3v2m0 3v5h3v-1h6m-9 3v6m3-6v3h3v3h3v-6m-3-3v1M3 12h5m10 6v-3"/>',
calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18m-13 5h2m4 0h2"/>',
spark:'<path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3z"/>'
};
const icon=n=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(icons[n]||icons.star)+'</svg>';
