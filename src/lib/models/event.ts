export type HcEvent = {
	type: string;
	timestamp: string;
	device_id?: string;
	[key: string]: unknown;
};
