export type HcEvent = {
	type: string;
	timestamp: string;
	device_id?: string;
	[key: string]: unknown;
};

export type LogEntry = {
	seq: number;
	event_type: string;
	device_id?: string;
	event: HcEvent & {
		scene_id?: string;
		scene_name?: string;
	};
};
