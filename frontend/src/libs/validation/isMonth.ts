export function isMonth(month: number): boolean {
	return !Number.isNaN(month) && Number.isInteger(month) && month >= 1 && month <= 12;
}
