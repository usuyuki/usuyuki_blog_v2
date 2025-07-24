export function isYear(year: number): boolean {
	return !Number.isNaN(year) && Number.isInteger(year) && year >= 1000 && year <= 9999;
}
