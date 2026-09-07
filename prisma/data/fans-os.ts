/**
 * Case fans and operating system licences.
 *
 * Fans are the only "multiple" core kind besides storage, and they exist in the
 * builder mainly so the engine's "this case ships with no fans" warning has
 * something to point at. They carry no clearance columns — a 120mm fan fits any
 * case that lists a 120mm mount.
 *
 * The operating system rows are priced items with no physical specs at all.
 * "No Operating System" is deliberately priced at 0 rather than omitted, so a
 * customer bringing their own licence can say so explicitly in the builder.
 */

import type { SeedProduct } from "./types.ts";
import { spec, MFR_WARRANTY } from "./types.ts";

export const fans: SeedProduct[] = [
  {
    sku: "YG-FAN-001",
    slug: "lian-li-uni-fan-sl-infinity-120-3-pack",
    name: "Lian Li UNI FAN SL-Infinity 120 (3-pack)",
    kind: "fan",
    brand: "Lian Li",
    category: "case-fans",
    headline: "Fans that clip to each other — one cable for all three.",
    description:
      "The UNI FAN interlocking design lets fans snap together side by side and share a single cable back to the controller, which removes most of the wiring a three-fan RGB install normally needs. Sixteen addressable LEDs on the front ring and thirteen on the back. Includes the controller.",
    price: 18500,
    stock: 8,
    warranty: MFR_WARRANTY,
    rgb: true,
    specSheet: [
      spec("Fan", "Size", "120 mm"),
      spec("Fan", "Quantity", "3 fans plus controller"),
      spec("Performance", "Speed", "200 – 2100 RPM PWM"),
      spec("Performance", "Airflow", "Up to 61.3 CFM"),
      spec("Acoustics", "Rated noise", "Up to 29 dB(A)"),
      spec("Lighting", "RGB", "29 addressable LEDs per fan"),
      spec("Cabling", "System", "Interlocking, single cable per array"),
    ],
  },
  {
    sku: "YG-FAN-002",
    slug: "corsair-rs120-argb-3-pack",
    name: "Corsair RS120 ARGB (3-pack)",
    kind: "fan",
    brand: "Corsair",
    category: "case-fans",
    headline: "Eight addressable LEDs a fan, with a hub in the box.",
    description:
      "A three-pack of 120mm ARGB fans with the lighting hub and PWM splitter included, so they can be installed without buying anything else. Rated to 2100 RPM and 61.7 CFM. They pair with iCUE if you run other Corsair hardware, and work from the motherboard header if you do not.",
    price: 12500,
    stock: 10,
    warranty: MFR_WARRANTY,
    rgb: true,
    specSheet: [
      spec("Fan", "Size", "120 mm"),
      spec("Fan", "Quantity", "3 fans plus hub"),
      spec("Performance", "Speed", "400 – 2100 RPM PWM"),
      spec("Performance", "Airflow", "Up to 61.7 CFM"),
      spec("Acoustics", "Rated noise", "Up to 32 dB(A)"),
      spec("Lighting", "RGB", "8 addressable LEDs per fan"),
    ],
  },
  {
    sku: "YG-FAN-003",
    slug: "thermalright-tl-c12c-s-3-pack",
    name: "Thermalright TL-C12C-S (3-pack)",
    kind: "fan",
    brand: "Thermalright",
    category: "case-fans",
    headline: "Three good PWM fans for less than one premium one.",
    description:
      "Plain black 120mm PWM fans with fluid dynamic bearings and rubber corner pads. There is no lighting and no controller — just three quiet fans at a price that makes filling a case cheap. A sensible pairing with any mesh-front chassis.",
    price: 3500,
    stock: 15,
    warranty: MFR_WARRANTY,
    specSheet: [
      spec("Fan", "Size", "120 mm"),
      spec("Fan", "Quantity", "3"),
      spec("Performance", "Speed", "1500 RPM PWM"),
      spec("Performance", "Airflow", "Up to 66.17 CFM"),
      spec("Acoustics", "Rated noise", "Up to 25.6 dB(A)"),
      spec("Bearing", "Type", "Fluid dynamic"),
    ],
  },
  {
    sku: "YG-FAN-004",
    slug: "noctua-nf-a12x25-pwm",
    name: "Noctua NF-A12x25 PWM",
    kind: "fan",
    brand: "Noctua",
    category: "case-fans",
    headline: "The 120mm fan every other 120mm fan is compared with.",
    description:
      "A single 120mm fan with a sub-millimetre tip clearance made possible by a stiff liquid-crystal-polymer impeller. It performs on a radiator as well as it does in open air, which almost nothing else in this size does. Expensive for one fan, and worth it where noise matters most.",
    price: 9500,
    stock: 9,
    warranty: MFR_WARRANTY,
    specSheet: [
      spec("Fan", "Size", "120 mm"),
      spec("Fan", "Quantity", "1"),
      spec("Performance", "Speed", "450 – 2000 RPM PWM"),
      spec("Performance", "Airflow", "Up to 60.1 CFM"),
      spec("Performance", "Static pressure", "2.34 mm H₂O"),
      spec("Acoustics", "Rated noise", "Up to 22.6 dB(A)"),
      spec("Bearing", "Type", "SSO2 magnetic stabilised"),
    ],
  },
  {
    sku: "YG-FAN-005",
    slug: "be-quiet-silent-wings-4-120mm-pwm",
    name: "be quiet! Silent Wings 4 120mm PWM",
    kind: "fan",
    brand: "be quiet!",
    category: "case-fans",
    headline: "Under 19 dB(A) at full speed. Nothing else is this quiet.",
    description:
      "A 120mm fan built around a fluid-dynamic bearing and a seven-blade impeller, rated at 18.9 dB(A) at maximum speed. It ships with both rubber and hard mounting corners so it can be fitted for minimum vibration or maximum static pressure.",
    price: 7500,
    stock: 11,
    warranty: MFR_WARRANTY,
    specSheet: [
      spec("Fan", "Size", "120 mm"),
      spec("Fan", "Quantity", "1"),
      spec("Performance", "Speed", "Up to 1600 RPM PWM"),
      spec("Performance", "Airflow", "Up to 50.5 CFM"),
      spec("Acoustics", "Rated noise", "18.9 dB(A)"),
      spec("Bearing", "Type", "Fluid dynamic"),
      spec("In the box", "Mounts", "Rubber and rigid corner sets"),
    ],
  },
  {
    sku: "YG-FAN-006",
    slug: "deepcool-fc120-argb-3-pack",
    name: "Deepcool FC120 ARGB (3-pack)",
    kind: "fan",
    brand: "Deepcool",
    category: "case-fans",
    headline: "Daisy-chainable ARGB fans that cost very little.",
    description:
      "Three 120mm ARGB fans that chain to each other through short pass-through connectors, so only one cable reaches the motherboard header. Rated to 1800 RPM. A cheap way to light a build without a separate controller.",
    price: 7000,
    stock: 12,
    warranty: MFR_WARRANTY,
    rgb: true,
    specSheet: [
      spec("Fan", "Size", "120 mm"),
      spec("Fan", "Quantity", "3"),
      spec("Performance", "Speed", "500 – 1800 RPM PWM"),
      spec("Performance", "Airflow", "Up to 61.9 CFM"),
      spec("Acoustics", "Rated noise", "Up to 28 dB(A)"),
      spec("Lighting", "RGB", "Addressable, daisy-chain wiring"),
    ],
  },
  {
    sku: "YG-FAN-007",
    slug: "nzxt-f120-rgb-core-3-pack",
    name: "NZXT F120 RGB Core (3-pack)",
    kind: "fan",
    brand: "NZXT",
    category: "case-fans",
    headline: "Eight LEDs a fan and an RGB controller in the box.",
    description:
      "A three-pack of 120mm RGB fans with NZXT's controller included, managed through CAM. Rated to 1800 RPM with a fluid dynamic bearing. Straightforward to install and a match for the H-series cases if you already own one.",
    price: 11000,
    stock: 7,
    warranty: MFR_WARRANTY,
    rgb: true,
    specSheet: [
      spec("Fan", "Size", "120 mm"),
      spec("Fan", "Quantity", "3 fans plus controller"),
      spec("Performance", "Speed", "500 – 1800 RPM PWM"),
      spec("Performance", "Airflow", "Up to 62.3 CFM"),
      spec("Acoustics", "Rated noise", "Up to 27.5 dB(A)"),
      spec("Lighting", "RGB", "8 addressable LEDs per fan"),
    ],
  },
];

export const operatingSystems: SeedProduct[] = [
  {
    sku: "YG-OS-001",
    slug: "microsoft-windows-11-home-oem",
    name: "Microsoft Windows 11 Home (OEM)",
    kind: "os",
    brand: "Microsoft",
    category: "operating-systems",
    headline: "The standard licence for a gaming PC.",
    description:
      "A single-machine OEM licence for Windows 11 Home, 64-bit. It includes DirectStorage, Auto HDR and the Xbox Game Bar, which is everything a gaming machine needs. An OEM licence is tied to the first system it is activated on and cannot be transferred to another machine later.",
    price: 32000,
    stock: 20,
    warranty: null,
    specSheet: [
      spec("Licence", "Edition", "Windows 11 Home"),
      spec("Licence", "Type", "OEM, single machine"),
      spec("Licence", "Architecture", "64-bit"),
      spec("Features", "Gaming", "DirectStorage, Auto HDR, Xbox Game Bar"),
      spec("Requirements", "Security", "TPM 2.0 and Secure Boot required"),
      spec("Note", "Transferability", "OEM licences stay with the first system"),
    ],
  },
  {
    sku: "YG-OS-002",
    slug: "microsoft-windows-11-pro-oem",
    name: "Microsoft Windows 11 Pro (OEM)",
    kind: "os",
    brand: "Microsoft",
    category: "operating-systems",
    headline: "Adds BitLocker, Hyper-V and Remote Desktop.",
    description:
      "Windows 11 Pro adds BitLocker drive encryption, Hyper-V virtualisation, Remote Desktop hosting and domain join over the Home edition. For a purely gaming machine those features go unused; for a machine that also does work, they usually justify the difference.",
    price: 48000,
    stock: 15,
    warranty: null,
    specSheet: [
      spec("Licence", "Edition", "Windows 11 Pro"),
      spec("Licence", "Type", "OEM, single machine"),
      spec("Licence", "Architecture", "64-bit"),
      spec("Features", "Security", "BitLocker drive encryption"),
      spec("Features", "Virtualisation", "Hyper-V"),
      spec("Features", "Remote", "Remote Desktop host, domain join"),
      spec("Requirements", "Security", "TPM 2.0 and Secure Boot required"),
    ],
  },
  {
    sku: "YG-OS-003",
    slug: "no-operating-system",
    name: "No Operating System",
    kind: "os",
    brand: null,
    category: "operating-systems",
    headline: "Bring your own licence, or install Linux.",
    description:
      "Choose this if you already hold a Windows licence, intend to install Linux, or would rather set the machine up yourself. The build is delivered with the BIOS configured and the memory profile enabled, but no operating system installed.",
    price: 0,
    stock: 99,
    warranty: null,
    specSheet: [
      spec("Licence", "Included", "None"),
      spec("Licence", "Price", "No charge"),
      spec("Setup", "What we still do", "BIOS update and memory profile enabled"),
      spec("Setup", "What you do", "Install your own operating system"),
      spec("Options", "Alternatives", "Your own Windows licence, or any Linux distribution"),
    ],
  },
];
