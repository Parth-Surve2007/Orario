---
name: Glacier Light
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#43474b'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#73787b'
  outline-variant: '#c3c7cb'
  surface-tint: '#50616b'
  primary: '#50616b'
  on-primary: '#ffffff'
  primary-container: '#e0f2fe'
  on-primary-container: '#5e6f79'
  inverse-primary: '#b7c9d5'
  secondary: '#006686'
  on-secondary: '#ffffff'
  secondary-container: '#7ed4fd'
  on-secondary-container: '#005b78'
  tertiary: '#576065'
  on-tertiary: '#ffffff'
  tertiary-container: '#e8f1f7'
  on-tertiary-container: '#656e73'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d3e5f1'
  primary-fixed-dim: '#b7c9d5'
  on-primary-fixed: '#0c1e26'
  on-primary-fixed-variant: '#384953'
  secondary-fixed: '#c0e8ff'
  secondary-fixed-dim: '#7bd1fa'
  on-secondary-fixed: '#001e2b'
  on-secondary-fixed-variant: '#004d66'
  tertiary-fixed: '#dbe4ea'
  tertiary-fixed-dim: '#bfc8ce'
  on-tertiary-fixed: '#141d21'
  on-tertiary-fixed-variant: '#3f484d'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '300'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '400'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '400'
    lineHeight: 32px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 8px
  container-padding: 24px
  gutter: 16px
  glass-padding: 20px
---

## Brand & Style
The design system embodies an ethereal, atmospheric aesthetic focused on clarity, depth, and light. It targets high-end productivity tools and wellness platforms that require a sense of calm and focus.

The style is a refined **Light Glassmorphism**. It utilizes multi-layered translucency, high-intensity backdrop blurs, and whisper-thin outlines to create a UI that feels like it’s floating in an airy, illuminated space. The emotional response is one of weightlessness and professional serenity, moving away from heavy containers toward ephemeral, light-refracting surfaces.

## Colors
The palette is centered on a spectrum of icy blues and crystalline whites. 

- **Primary (#E0F2FE):** Used for soft highlights and active states. It should feel cool and refreshing.
- **Surface Strategy:** Backgrounds are not solid; they use wide, linear gradients (e.g., from #F8FAFC to #E0F2FE) to simulate an atmospheric horizon.
- **Translucency:** The "Glass" effect relies on a white base with 40-60% opacity, paired with a high `backdrop-filter: blur(12px)`.
- **Text:** High-contrast neutral slate is used for readability, while secondary text uses a lighter tint to maintain the airy feel.

## Typography
This design system utilizes **Inter** for its systematic clarity. To maintain the "Light Glass" feel, we lean heavily on lighter font weights (300 and 400) for large headings to avoid visual heaviness.

- **Headlines:** Use a tighter letter-spacing and lighter weights to mimic high-end editorial layouts.
- **Readability:** Ensure body text maintains sufficient contrast against translucent backgrounds.
- **Labels:** Uppercase is used sparingly for navigation and small metadata to provide structure without bulk.

## Layout & Spacing
The layout follows a **Fluid Grid** model with generous white space (or "empty air") to let the glass elements breathe. 

- **Breathing Room:** Elements are never cramped. Increase internal padding within glass containers to emphasize the blurred background.
- **Desktop:** 12-column grid with 24px gutters.
- **Mobile:** 4-column grid with 16px margins.
- **Layering:** Vertical spacing is used to denote hierarchy; elements with more "depth" (higher blur) typically have larger margins to suggest they are floating closer to the user.

## Elevation & Depth
Depth is achieved through **Glassmorphism and Ambient Shadows** rather than traditional gray-scale stacking.

- **The Glass Stack:**
  - **Level 1 (Base):** Subtle 10% white tint, 4px blur.
  - **Level 2 (Floating):** 40% white tint, 12px blur, 1px solid white border (20% opacity).
  - **Level 3 (Modals):** 60% white tint, 24px blur, 1px solid white border (40% opacity).
- **Shadows:** Use extremely soft, long-range shadows with a hint of the primary blue (`rgba(186, 230, 253, 0.2)`). This simulates light passing through ice.
- **Outlines:** Every glass element must have a 1px "inner glow" or top-left border that is slightly more opaque than the rest of the stroke to simulate a light source reflecting off an edge.

## Shapes
The shape language is consistently **Rounded**. Sharp corners are avoided to maintain the soft, liquid feel of the interface. 

- **Standard Containers:** Use 16px (`rounded-lg`) for main cards and glass panels.
- **Interactive Elements:** Buttons and inputs use 8px (`rounded-md`) to appear precise yet approachable.
- **Outer Shells:** Main application containers or wrappers use 24px (`rounded-xl`) to frame the entire experience.

## Components
- **Buttons:** Primary buttons use a solid light-blue gradient with a subtle white inner shadow. Secondary buttons are "Ghost Glass"—transparent with only a light border and backdrop blur.
- **Input Fields:** Semi-transparent white fills (20% opacity). On focus, the opacity increases and the border glows with the primary color.
- **Cards:** The core of the system. Must feature `backdrop-filter: blur()`. Edges should have a multi-layered stroke: a 1px white border at low opacity.
- **Chips/Badges:** Pill-shaped with high translucency. Used for categorization without breaking the visual flow.
- **Lists:** Separated by thin, semi-transparent lines (1px white at 10% opacity) rather than heavy dividers.
- **Modals:** High-intensity blur background overlay (e.g., `blur(20px)`) to completely isolate the user's focus onto the floating glass pane.