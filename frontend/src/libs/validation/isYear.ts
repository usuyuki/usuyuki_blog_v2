export function isYear(year: number): boolean {
	return !isNaN(year) && Number.isInteger(year) && year >= 1000 && year <= 9999;
}
