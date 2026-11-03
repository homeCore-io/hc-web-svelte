// The tests read in homeCore's own units, whatever the machine's language:
// °C and metric, as the schemas say. `units.test.ts` covers the rest.
import { followUnits } from './units.js';

followUnits(() => ({ temperature: 'C', measures: 'metric' }));
