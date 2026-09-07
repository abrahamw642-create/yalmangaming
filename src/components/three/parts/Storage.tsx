"use client";

/**
 * Drives. One component, three real form factors, because a build can mix them
 * and they only differ in proportions and where the connector sits.
 *
 * Every drive is modelled around its own centre in a neutral frame:
 *
 *      X = width      (M.2 22 mm, 2.5" 70 mm, 3.5" 101.6 mm)
 *      Y = thickness  (M.2 3 mm,  2.5" 7 mm,  3.5" 26 mm)
 *      Z = length     (M.2 80 mm, 2.5" 100 mm, 3.5" 147 mm)
 *
 * The caller supplies the position and rotation, so the same component draws an
 * M.2 stick lying on the motherboard in board-local space and a 2.5" SSD bolted
 * to the PSU shroud in case space without knowing which frame it is in. That is
 * deliberate: `Storage` never guesses where a drive lives, because "where does
 * this drive mount" is a property of the chassis, not of the drive.
 *
 * `type` comes straight from `storageInterface` on the real part:
 * `nvme-gen4`/`nvme-gen5` → M.2, `sata` → 2.5", `hdd` → 3.5".
 */

import * as React from "react";
import * as THREE from "three";
import {
  detail,
  roundedBoxGeometry,
  useDisposableSet,
  useMaterials,
  useQuality,
} from "../Rig";

export type DriveType = "m2" | "ssd" | "hdd";

export type DrivePlacement = {
  type: DriveType;
  position: [number, number, number];
  rotation?: [number, number, number];
  /**
   * M.2 module length in scene units. 2280 — the size that fits every board we
   * sell — is 0.8. Ignored for the other two form factors.
   */
  length?: number;
  /** Lit heatspreader. Only M.2 modules and a few SSDs actually have one. */
  rgb?: boolean;
};

export type StorageProps = {
  drives: DrivePlacement[];
};

/** 2.5" and 3.5" outer dimensions, scene units (1 = 100 mm). */
const SSD = { w: 0.7, h: 0.07, d: 1.0 };
const HDD = { w: 1.016, h: 0.26, d: 1.47 };

export function Storage({ drives }: StorageProps) {
  const mats = useMaterials();
  const quality = useQuality();
  const bevel = detail(quality, 2, 1);

  // Every M.2 module in a build is 2280 unless the caller says otherwise, so
  // one geometry set covers the whole selection; a mixed-length build gets the
  // longest and the shorter sticks are scaled down on Z, which is invisible at
  // any distance you actually view this from.
  const m2Length = React.useMemo(() => {
    const lengths = drives
      .filter((d) => d.type === "m2")
      .map((d) => d.length ?? 0.8);
    return lengths.length ? Math.max(...lengths) : 0.8;
  }, [drives]);

  const geo = useDisposableSet(
    () => ({
      m2Pcb: new THREE.BoxGeometry(0.22, 0.012, m2Length),
      m2Spreader: roundedBoxGeometry(0.21, 0.03, m2Length - 0.07, 0.008, bevel),
      m2Strip: new THREE.BoxGeometry(0.14, 0.006, m2Length - 0.22),
      m2Contacts: new THREE.BoxGeometry(0.19, 0.016, 0.035),
      m2Screw: new THREE.CylinderGeometry(0.022, 0.022, 0.02, 6),

      ssdBody: roundedBoxGeometry(SSD.w, SSD.h, SSD.d, 0.012, bevel),
      ssdLabel: new THREE.BoxGeometry(SSD.w * 0.78, 0.004, SSD.d * 0.6),
      ssdPort: new THREE.BoxGeometry(SSD.w * 0.55, 0.03, 0.028),

      hddBody: roundedBoxGeometry(HDD.w, HDD.h, HDD.d, 0.014, bevel),
      hddLid: new THREE.BoxGeometry(HDD.w * 0.9, 0.006, HDD.d * 0.86),
      hddPcb: new THREE.BoxGeometry(HDD.w * 0.88, 0.016, HDD.d * 0.78),
      hddPort: new THREE.BoxGeometry(HDD.w * 0.5, 0.05, 0.03),
    }),
    [m2Length, bevel],
  );

  return (
    <group>
      {drives.map((drive, i) => {
        const rotation = drive.rotation ?? [0, 0, 0];

        if (drive.type === "m2") {
          const scale = (drive.length ?? 0.8) / m2Length;
          return (
            <group key={i} position={drive.position} rotation={rotation} scale={[1, 1, scale]}>
              <mesh geometry={geo.m2Pcb} material={mats.pcb} />
              <mesh
                geometry={geo.m2Contacts}
                material={mats.gold}
                position={[0, 0, -m2Length / 2 + 0.02]}
              />
              <mesh
                geometry={geo.m2Spreader}
                material={mats.aluminiumDark}
                position={[0, 0.021, 0.02]}
              />
              {/* The lit strip along the spreader — the only thing you can see
                  of an NVMe drive once the side panel is on. */}
              <mesh
                geometry={geo.m2Strip}
                material={drive.rgb ? mats.rgb[1] : mats.label}
                position={[0, 0.038, 0.02]}
              />
              <mesh
                geometry={geo.m2Screw}
                material={mats.chrome}
                position={[0, 0.016, m2Length / 2 - 0.03]}
              />
            </group>
          );
        }

        if (drive.type === "hdd") {
          return (
            <group key={i} position={drive.position} rotation={rotation}>
              <mesh geometry={geo.hddBody} material={mats.aluminiumDark} />
              {/* Stamped top lid — the mirror-finish plate is the giveaway that
                  this is a mechanical drive and not another SSD. */}
              <mesh
                geometry={geo.hddLid}
                material={mats.chrome}
                position={[0, HDD.h / 2 - 0.002, 0]}
              />
              <mesh
                geometry={geo.hddPcb}
                material={mats.pcb}
                position={[0, -HDD.h / 2 - 0.006, 0]}
              />
              <mesh
                geometry={geo.hddPort}
                material={mats.plastic}
                position={[0, -HDD.h * 0.28, -HDD.d / 2 - 0.012]}
              />
            </group>
          );
        }

        return (
          <group key={i} position={drive.position} rotation={rotation}>
            <mesh geometry={geo.ssdBody} material={mats.chassisEdge} />
            <mesh
              geometry={geo.ssdLabel}
              material={mats.label}
              position={[0, SSD.h / 2 - 0.001, 0]}
            />
            <mesh
              geometry={geo.ssdPort}
              material={mats.plastic}
              position={[0, -0.004, -SSD.d / 2 - 0.012]}
            />
          </group>
        );
      })}
    </group>
  );
}

export default Storage;
