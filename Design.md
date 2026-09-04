---
name: Berkah Mulia Design System
colors:
  surface: '#faf8ff'
  surface-dim: '#d2d9f4'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f3ff'
  surface-container: '#eaedff'
  surface-container-high: '#e2e7ff'
  surface-container-highest: '#dae2fd'
  on-surface: '#131b2e'
  on-surface-variant: '#3c4a42'
  inverse-surface: '#283044'
  inverse-on-surface: '#eef0ff'
  outline: '#6c7a71'
  outline-variant: '#bbcabf'
  surface-tint: '#006c49'
  primary: '#006c49'
  on-primary: '#ffffff'
  primary-container: '#10b981'
  on-primary-container: '#00422b'
  inverse-primary: '#4edea3'
  secondary: '#0058be'
  on-secondary: '#ffffff'
  secondary-container: '#2170e4'
  on-secondary-container: '#fefcff'
  tertiary: '#855300'
  on-tertiary: '#ffffff'
  tertiary-container: '#e29100'
  on-tertiary-container: '#523200'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#6ffbbe'
  primary-fixed-dim: '#4edea3'
  on-primary-fixed: '#002113'
  on-primary-fixed-variant: '#005236'
  secondary-fixed: '#d8e2ff'
  secondary-fixed-dim: '#adc6ff'
  on-secondary-fixed: '#001a42'
  on-secondary-fixed-variant: '#004395'
  tertiary-fixed: '#ffddb8'
  tertiary-fixed-dim: '#ffb95f'
  on-tertiary-fixed: '#2a1700'
  on-tertiary-fixed-variant: '#653e00'
  background: '#faf8ff'
  on-background: '#131b2e'
  surface-variant: '#dae2fd'
typography:
  display-lg:
    fontFamily: sora
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: sora
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
  headline-lg-mobile:
    fontFamily: sora
    fontSize: 28px
    fontWeight: '600'
    lineHeight: '1.2'
  headline-md:
    fontFamily: sora
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
  body-lg:
    fontFamily: inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  label-md:
    fontFamily: inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: '1.4'
    letterSpacing: 0.01em
  label-sm:
    fontFamily: inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1.2'
rounded:
  sm: 0.5rem
  DEFAULT: 1rem
  md: 1.5rem
  lg: 2rem
  xl: 3rem
  full: 9999px
spacing:
  base: 8px
  container-max: 1280px
  gutter: 24px
  margin-desktop: 64px
  margin-mobile: 20px
---

## Brand & Style

The design system is built upon the principles of **Ethical Modernism**, blending Sharia-compliant financial stability with the high-tech transparency of contemporary gold investment. The visual identity targets professional investors and families seeking a secure, ethical harbor for their wealth.

The design style utilizes **Professional Glassmorphism**. This approach features frosted glass panels that appear to float over organic, high-end backgrounds. The UI evokes a sense of clarity, depth, and "digital tangibility." By using translucent layers and backdrop blurs, the system maintains a light, breathable feel while emphasizing the premium nature of gold assets. The overall emotional response is one of calm confidence, technological sophistication, and ethical prosperity.

## Colors

The palette is anchored by **Emerald Green (#10B981)**, representing growth and Sharia-compliant integrity. This is complemented by **Electric Blue (#3B82F6)** for financial data and interactive growth elements, creating a dual-tone "fintech" core.

**Gold (#F59E0B)** is reserved as a high-value accent, used sparingly for premium tiers, gold balance highlights, and achievement states to maintain its perceived worth. The background uses a **Soft Sky Blue (#F0F7FF)** base, often layered with subtle mesh gradients or abstract geometric patterns in pale tints of blue and green. Surfaces rely on high-transparency whites to achieve the frosted glass effect, ensuring the UI feels airy rather than heavy.

## Typography

This design system employs a strategic pairing of **Sora** and **Inter**. **Sora** is used for all headlines and display text, lending a geometric, futuristic, and premium character to the investment experience. Its wide proportions communicate stability and openness.

**Inter** serves as the workhorse for body copy, data tables, and labels. It provides exceptional legibility for financial figures and long-form ethical disclosures. For data-heavy views (like gold price charts), use `Inter` with tabular spacing to ensure numbers align vertically for easy comparison.

## Layout & Spacing

The layout philosophy follows a **Fluid Grid** model with generous white space to reinforce the premium, "uncluttered" brand promise. A 12-column grid is used for desktop, shifting to a 4-column grid for mobile.

Spacing follows an 8px linear scale. Larger increments (48px, 64px, 80px) are encouraged between major sections to emphasize the "Glass" panels and allow the background mesh gradients to breathe. Content containers should use significant internal padding (minimum 32px) to ensure the frosted glass edges are clearly visible against the content within.

## Elevation & Depth

Depth is conveyed through **Physical Layering** and **Backdrop Blurs**. Instead of traditional dark shadows, this design system uses:

1.  **Backdrop Blur:** Primary panels use a `20px` to `40px` blur radius to separate foreground content from the background pattern.
2.  **Inner Glows:** A subtle 1px white border with 40% opacity on the top and left edges of panels mimics light hitting a glass edge.
3.  **Ambient Shadows:** Low-opacity, diffused shadows (e.g., `rgba(15, 23, 42, 0.08)`) with a high spread are used to lift active cards or modals.
4.  **Tinted Overlays:** Modals use a semi-transparent Navy (#0F172A) backdrop at 20% opacity with a heavy blur to maintain focus without losing the "light mode" feel.

## Shapes

The shape language is defined by **Pill-shaped (3)** aesthetics. This level of roundedness (32px+ for cards, fully rounded for buttons) communicates friendliness and modern accessibility. 

Investment cards, input fields, and action buttons all share these organic, hyper-rounded corners. This softness counterbalances the technical nature of "Gold Savings" and "Sharia Finance," making the platform feel approachable for all users.

## Components

### Buttons
Primary buttons use the Emerald Green gradient with white text. They are pill-shaped and feature a subtle elevation shadow. Secondary buttons utilize the "Glass" style: a transparent fill with a semi-opaque border and backdrop blur.

### Glass Cards
The signature component. These must have a `backdrop-filter: blur(20px)`, a `1px` semi-transparent border, and a `32px` internal padding. They are used to house gold balances, portfolio breakdowns, and transaction history.

### Inputs
Fields are pill-shaped with a soft Sky Blue background. Upon focus, the border transitions to Electric Blue with a soft outer glow.

### Progress & Charts
Charts should use smooth, curved lines (Bezier) rather than jagged points to reflect organic growth. Progress bars for savings goals use the Emerald-to-Electric Blue gradient.

### Gold Accent Components
Specific premium features, such as "Zakat Calculator" or "Gold Delivery," use a thin 2px Gold (#F59E0B) border or a gold-tinted glass effect to denote their special status within the ecosystem.