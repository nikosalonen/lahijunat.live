<!-- @format -->

# Animation Improvements for lahijunat.live

## Overview

Enhanced the animation system across the application to provide smoother, more engaging user interactions while maintaining performance and accessibility.

## Key Improvements Made

### 1. **Enhanced Tailwind Animation System**

- Added new keyframe animations: `slide-up`, `slide-down`, `scale-in`, `bounce-subtle`, `shimmer`, `train-arrive`, `train-depart`
- Improved timing functions and durations for better feel
- Added staggered animation delays for list items

### 2. **Loading State Animations**

- **Shimmer Effect**: Replaced basic pulse with sophisticated shimmer animation for skeleton states
- **Staggered Loading**: Train cards and list items now animate in with staggered delays
- **Enhanced Spinner**: Dual-ring loading spinner with counter-rotating elements

### 3. **Interactive Element Enhancements**

- **Hover Lift**: Subtle lift effect on interactive cards and buttons
- **Focus Rings**: Consistent, accessible focus indicators
- **Scale Feedback**: Button press animations with `active:scale-95`
- **Micro-interactions**: Enhanced button states with better transitions

### 4. **List and Grid Animations**

- **Train Arrival**: New trains slide in from the left with `train-arrive` animation
- **Train Departure**: Departed trains slide out to the right with `train-depart`
- **Staggered Reveals**: List items appear with incremental delays
- **Grid Transitions**: Smooth layout changes when items are added/removed

### 5. **Dropdown and Modal Animations**

- **Slide Down**: Station selection dropdowns animate in from top
- **Scale In**: Selected options and highlights use scale-in effect
- **Height Transitions**: Smooth expand/collapse for dynamic content

### 6. **New Components**

- **AnimatedToast**: Toast notification system with entrance/exit animations
- **useAnimatedToast**: Hook for managing animated notifications
- Enhanced existing components with better animation patterns

## CSS Enhancements

### New Utility Classes

```css
.shimmer-bg          /* Gradient background for shimmer effect */
/* Gradient background for shimmer effect */
.stagger-1 to .5     /* Animation delay utilities */
.height-transition   /* Smooth height changes */
.focus-ring         /* Consistent focus states */
.hover-lift; /* Subtle hover elevation */
```

### Animation Timing

- **Fast interactions**: 150ms for button states
- **Medium transitions**: 300-400ms for content changes
- **Slow animations**: 700ms+ for layout transitions
- **Stagger delays**: 50-100ms between list items

## Performance Considerations

### Optimizations Applied

- Used `transform` and `opacity` for GPU acceleration
- Avoided animating layout properties where possible
- Implemented `will-change` hints for complex animations
- Staggered animations to prevent overwhelming the GPU

### Accessibility Features

- Respects `prefers-reduced-motion` (can be added)
- Maintains focus management during animations
- Screen reader friendly with proper ARIA labels
- Keyboard navigation preserved during transitions

## Usage Examples

### Basic Hover Effect

```tsx
<button class="hover-lift focus-ring transition-all duration-150">
  Click me
</button>
```

### Staggered List Animation

```tsx
{
  items.map((item, index) => (
    <div
      key={item.id}
      class={`animate-scale-in stagger-${Math.min(index + 1, 5)}`}
    >
      {item.content}
    </div>
  ));
}
```

### Loading Skeleton

```tsx
<div class="shimmer-bg animate-shimmer bg-gray-200 rounded h-4 w-32" />
```

## Future Enhancement Opportunities

### Advanced Animations

1. **Page Transitions**: Route-level animations between pages
2. **Gesture Animations**: Swipe-to-refresh, pull-to-load more
3. **Physics-based**: Spring animations for more natural feel
4. **Parallax Effects**: Subtle depth on scroll (mobile-friendly)

### Interactive Enhancements

1. **Drag & Drop**: Reorder favorite stations
2. **Progressive Disclosure**: Expandable train details
3. **Smart Animations**: Context-aware animation timing
4. **Haptic Feedback**: Enhanced mobile interactions

### Performance Optimizations

1. **Animation Pooling**: Reuse animation instances
2. **Intersection Observer**: Animate only visible elements
3. **Reduced Motion**: Comprehensive accessibility support
4. **Battery Awareness**: Reduce animations on low battery

## Implementation Notes

- All animations use CSS transforms for optimal performance
- Timing functions chosen for natural, responsive feel
- Consistent animation vocabulary across components
- Mobile-first approach with touch-friendly interactions
- Dark mode compatible with appropriate color schemes

The enhanced animation system provides a more polished, professional user experience while maintaining the app's performance and accessibility standards.
