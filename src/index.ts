import { World } from '@iwsdk/core';
import projectOptions from 'virtual:iwsdk-project';
import { loadFonts } from './style.js';
import { StewardSystem } from './steward-system.js';

// Hands-first in IWER unless ?controllers=1
{
  const q = new URLSearchParams(location.search);
  if (!q.has('controllers')) {
    const w = window as unknown as { IWER_DEVICE?: { primaryInputMode: string } };
    let n = 0;
    const apply = () => {
      if (w.IWER_DEVICE) w.IWER_DEVICE.primaryInputMode = 'hand';
      else if (n++ < 200) setTimeout(apply, 25);
    };
    apply();
  }
}

void loadFonts().then(() =>
  World.create(document.getElementById('scene-container') as HTMLDivElement, projectOptions).then((world) => {
    world.registerSystem(StewardSystem);
    (window as unknown as { __psWorld: unknown }).__psWorld = world;
  }),
);
