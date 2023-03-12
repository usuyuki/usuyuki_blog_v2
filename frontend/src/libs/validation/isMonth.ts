export function isMonth(month: number): boolean {
	return !isNaN(month) && Number.isInteger(month) && month >= 1 && month <= 12;
}
