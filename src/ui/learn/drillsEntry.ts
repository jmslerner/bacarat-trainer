/**
 * The Drills entry point, isolated in its own module so the rest of Learn loads even if the drills module
 * (built separately under ./drills) is missing: LearnView imports this file lazily.
 */
import { DrillsHub } from './drills';

export default DrillsHub;
