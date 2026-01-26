# courthive-components Enhancement Suggestion

## Issue: Modal Styling Limitation

**Current Limitation:** The `cModal.open()` function from `courthive-components` doesn't provide a way to apply custom styles or classes to the outer modal container. This makes it difficult to visually differentiate stacked/overlaid modals.

**Use Case:** When opening a format editor modal on top of a scoring modal, we want the format editor to have a distinct blue border on the outer modal frame, not just around the inner content.

**Current Workaround:** We wrap the content in a styled div, but this creates a border around the content area rather than the modal frame itself.

---

## Proposed Enhancement

Add support for custom styling through the `config` parameter:

### Option 1: Custom Class Name

```typescript
cModal.open({
  title: 'Score format',
  content: myContent,
  buttons: myButtons,
  config: {
    padding: '.5',
    maxWidth: 480,
    className: 'format-editor-modal', // NEW: Custom class for outer modal
  }
});
```

**CSS:**
```css
.format-editor-modal {
  background-color: #f8f9fa;
  border: 3px solid #0066cc;
  border-radius: 8px;
  box-shadow: 0 8px 16px rgba(0, 102, 204, 0.2);
}
```

### Option 2: Style Object

```typescript
cModal.open({
  title: 'Score format',
  content: myContent,
  buttons: myButtons,
  config: {
    padding: '.5',
    maxWidth: 480,
    style: { // NEW: Style object for outer modal
      backgroundColor: '#f8f9fa',
      border: '3px solid #0066cc',
      borderRadius: '8px',
      boxShadow: '0 8px 16px rgba(0, 102, 204, 0.2)',
    }
  }
});
```

### Option 3: Both (Most Flexible)

```typescript
interface ModalConfig {
  padding?: string;
  maxWidth?: number;
  className?: string;    // Custom class for modal container
  style?: CSSProperties; // Inline styles for modal container
}
```

---

## Implementation Notes

The enhancement should apply the class/style to the outermost modal container element (whatever element has the `modal` class or similar).

**Pseudo-code:**
```typescript
function open({ title, content, buttons, config, onClose }) {
  const modalContainer = createModalContainer();
  
  // Apply custom class if provided
  if (config?.className) {
    modalContainer.classList.add(config.className);
  }
  
  // Apply custom styles if provided
  if (config?.style) {
    Object.assign(modalContainer.style, config.style);
  }
  
  // ... rest of modal creation
}
```

---

## Benefits

1. **Visual Hierarchy** - Easily distinguish stacked modals
2. **Customization** - Apps can theme modals per use case
3. **Accessibility** - Better visual cues for modal layering
4. **Backward Compatible** - Optional parameters don't break existing code

---

## Current Workaround in TMX

**File:** `src/components/modals/matchUpFormat/matchUpFormat.ts`

```typescript
// Wrap content with styled border
const wrapper = document.createElement('div');
wrapper.style.backgroundColor = '#f8f9fa';
wrapper.style.border = '3px solid #0066cc';
wrapper.style.borderRadius = '8px';
wrapper.style.padding = '1em';
wrapper.style.boxShadow = '0 8px 16px rgba(0, 102, 204, 0.2)';
wrapper.appendChild(content);

openModal({ 
  title: 'Score format', 
  content: wrapper, // Wrapped content
  buttons,
  config: { padding: '0', maxWidth: 480 }
});
```

**Limitation:** Border appears around content area, not the modal frame itself.

---

## Priority

**Medium** - Workaround exists, but enhancement would improve UX and developer experience.

---

## Related

- TMX Issue: Format editor modal needs visual differentiation when overlaid on scoring modal
- Similar request might exist for other modal libraries (react-modal, etc.)

---

**Would this enhancement be possible in courthive-components?**
