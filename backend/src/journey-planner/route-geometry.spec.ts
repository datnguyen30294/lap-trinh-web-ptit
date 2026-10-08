import { expect, it } from 'vitest';
import {
  roadFromLegs,
  sliceRoad,
  type RoadGeometry,
} from './route-geometry.js';

it('uses leg boundaries on a loop instead of choosing the first nearest coordinate', () => {
  const line = (coordinates: number[][]): RoadGeometry => ({
    type: 'LineString',
    coordinates,
  });
  const road = roadFromLegs(
    [
      {
        steps: [
          {
            geometry: line([
              [105, 21],
              [106, 22],
              [105, 21],
              [107, 22],
            ]),
          },
        ],
      },
      {
        steps: [
          {
            geometry: line([
              [107, 22],
              [105, 21],
              [108, 23],
            ]),
          },
        ],
      },
    ],
    3,
  );
  expect(road.stop_indices).toEqual([0, 3, 5]);
  expect(sliceRoad(road, 1, 2).coordinates).toEqual([
    [107, 22],
    [105, 21],
    [108, 23],
  ]);
});

it('rejects incomplete or invalid legs before caching them', () => {
  expect(() => roadFromLegs([], 3)).toThrow();
  expect(() =>
    roadFromLegs(
      [
        {
          steps: [
            {
              geometry: {
                type: 'LineString',
                coordinates: [
                  [999, 21],
                  [105, 21],
                ],
              },
            },
          ],
        },
      ],
      2,
    ),
  ).toThrow();
});
