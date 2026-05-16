/**
 * Kiểm tra logic chọn ngày (tongquan.js) — chạy: node tests/scripts/verify-tongquan-date.mjs
 */
function startOfLocalDay(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function isSameLocalDay(a, b) {
    return (
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate()
    );
}

function parseDateInputValue(value) {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const [y, m, d] = value.split("-").map(Number);
    const parsed = new Date(y, m - 1, d);
    if (
        parsed.getFullYear() !== y ||
        parsed.getMonth() !== m - 1 ||
        parsed.getDate() !== d
    ) {
        return null;
    }
    return parsed;
}

function formatDateParam(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

function isoKeyLocal(d) {
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${mo}-${day}`;
}

function filterPaidOrdersByDate(orders, selectedDate) {
    const key = isoKeyLocal(selectedDate);
    return (Array.isArray(orders) ? orders : []).filter((o) => {
        if (!o || !o.paidAt) return false;
        const d = new Date(o.paidAt);
        return !Number.isNaN(d.getTime()) && isoKeyLocal(d) === key;
    });
}

const assert = (cond, msg) => {
    if (!cond) throw new Error(msg);
};

const today = startOfLocalDay(new Date());
assert(parseDateInputValue("2026-05-17")?.getDate() === 17, "parseDateInputValue");
assert(parseDateInputValue("2026-13-01") === null, "invalid month");
assert(formatDateParam(today).match(/^\d{4}-\d{2}-\d{2}$/), "formatDateParam");

const chartStart = new Date(2026, 4, 17);
chartStart.setDate(chartStart.getDate() - 6);
assert(chartStart.getDate() === 11, "chartStart -6 days");

const filtered = filterPaidOrdersByDate(
    [
        { id: 1, paidAt: "2026-05-17T10:00:00" },
        { id: 2, paidAt: "2026-05-16T10:00:00" }
    ],
    new Date(2026, 4, 17)
);
assert(filtered.length === 1 && filtered[0].id === 1, "filterPaidOrdersByDate");

console.log("verify-tongquan-date: OK (" + filtered.length + " sample assertions passed)");
