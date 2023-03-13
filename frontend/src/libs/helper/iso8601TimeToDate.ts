type DateType = {
	year: number;
	month: number;
	day: number;
};
/**
 * そのまま使うとTimezoneがUTCで日付変わる9時間付近の投稿の日付壊れるので必ずこれを利用する。
 * 正規表現で取ろうとしないこと！！！
 * @param dateString ISO 8601 format
 */
export const iso8601TimeToDate = (dateString: string): DateType => {
	const dataObj = new Date(dateString);
	const data: DateType = {
		year: dataObj.getFullYear(),
		month: dataObj.getMonth() + 1,
		day: dataObj.getDate()
	};
	return data;
};
