'use strict';

const s = 1000;
const m = s * 60;
const h = m * 60;
const d = h * 24;

function plural(ms, msAbs, n, name) {
	const isPlural = msAbs >= n * 1.5;
	return Math.round(ms / n) + ' ' + name + (isPlural ? 's' : '');
}

function fmtShort(ms) {
	const msAbs = Math.abs(ms);
	if (msAbs >= d) return Math.round(ms / d) + 'd';
	if (msAbs >= h) return Math.round(ms / h) + 'h';
	if (msAbs >= m) return Math.round(ms / m) + 'm';
	if (msAbs >= s) return Math.round(ms / s) + 's';
	return ms + 'ms';
}

function fmtLong(ms) {
	const msAbs = Math.abs(ms);
	if (msAbs >= d) return plural(ms, msAbs, d, 'day');
	if (msAbs >= h) return plural(ms, msAbs, h, 'hour');
	if (msAbs >= m) return plural(ms, msAbs, m, 'minute');
	if (msAbs >= s) return plural(ms, msAbs, s, 'second');
	return ms + ' ms';
}

module.exports = function ms(val, options) {
	options = options || {};
	if (typeof val === 'number' && Number.isFinite(val)) {
		return options.long ? fmtLong(val) : fmtShort(val);
	}
	throw new Error('ms: value is not a finite number: ' + JSON.stringify(val));
};
