import { describe, expect, it } from 'vitest';
import { ACTIVITY_SCENES, filterScenes, nextSceneIndex } from '../stream';

describe('activity stream', () => {
  it('only features catalog events and valid destination routes', () => {
    expect(ACTIVITY_SCENES).toHaveLength(10);
    expect(ACTIVITY_SCENES.every((scene) => scene.event.id === scene.eventId)).toBe(true);
    expect(ACTIVITY_SCENES.every((scene) => /^\/destinations\/[a-z0-9-]+$/.test(scene.href))).toBe(true);
  });

  it('filters categories and safely wraps sample replay', () => {
    expect(filterScenes(ACTIVITY_SCENES, 'ski').every((scene) => scene.category === 'ski')).toBe(true);
    expect(filterScenes(ACTIVITY_SCENES, 'art').some((scene) => scene.category === 'art')).toBe(true);
    expect(filterScenes(ACTIVITY_SCENES, 'sailing').some((scene) => scene.event.id === 'monaco-yacht-show')).toBe(true);
    expect(nextSceneIndex(7, 8)).toBe(0);
    expect(nextSceneIndex(0, 0)).toBe(0);
  });
});
