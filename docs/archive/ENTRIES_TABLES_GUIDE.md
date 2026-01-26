# Event Entries Tables Guide

## Overview

The Event Entries view provides a comprehensive interface for managing participant entries in tournament events. The interface is organized into multiple panels representing different entry statuses, with functionality tailored to the event type (Singles or Doubles).

## Entry Status Panels

### 1. Accepted Panel

**Purpose:** Displays participants who have been accepted into the main draw.

**Available Actions:**

- **Move participants** to: Alternates, Withdrawn
- **Change entry status** to other accepted statuses
- **Add to draw** (when draws exist)
- **Create flight** (for multi-flight events)
- **Seeding** (before draw creation)
- **Add entries** (before draw creation)

**Common Use Cases:**

- Managing the main participant list before draw creation
- Moving participants between accepted and alternate status
- Withdrawing participants from the event

---

### 2. Qualifying Panel

**Purpose:** Displays participants accepted into qualifying rounds.

**Available Actions:**

- **Move participants** to: Accepted, Alternates, Withdrawn
- **Seeding** (before draw creation)
- **Add entries** (before draw creation)

**Common Use Cases:**

- Managing qualifying participants separately from main draw
- Promoting qualifying participants to main draw acceptance

---

### 3. Alternates Panel

**Purpose:** Displays alternate participants who can replace withdrawn participants.

**Available Actions:**

- **Move participants** to: Accepted, Qualifying, Withdrawn
- **Destroy pairs** (Doubles only - splits pairs back into individual participants)
- **Add entries** (before draw creation)

**Common Use Cases:**

- Maintaining a list of backup participants
- Promoting alternates to accepted status when spots open
- In Doubles: Breaking up pairs that need to be reconfigured

---

### 4. Ungrouped Panel

**Purpose:** Displays individual participants in Doubles events who are not yet part of a pair.

**Visibility:**

- **Singles Events:** Hidden (not applicable)
- **Doubles Events:** Visible before draw creation
- **After Draw Creation:** Hidden

**Available Actions:**

- **Search Participants** - Filter the ungrouped list to quickly find participants
- **Move participants** to: Withdrawn (for individual participants)
- **Create Pair** button (when Auto Pair is OFF and exactly 2 participants are selected)
- **Auto Pair toggle** (Controls automatic pair creation)

#### Auto Pair Feature

The Auto Pair toggle appears in the **RIGHT** area of the control bar and controls how pairs are created:

**Auto Pair: ON (Default)**

- When you select 2 participants, they automatically become a pair
- The pair is immediately created and moved to the Alternates table
- Ideal for rapid pair creation workflow

**Auto Pair: OFF**

- When you select 2 participants, a **[Create Pair]** button appears
- You must manually click **[Create Pair]** to finalize the pairing
- Gives you time to review the pairing before committing
- The **[Create Pair]** button appears to the left of **[Move participants]**

**Toggle Behavior:**

- Click **[Auto Pair: ON]** to switch to **[Auto Pair: OFF]**
- Click **[Auto Pair: OFF]** to switch to **[Auto Pair: ON]**
- When switching back to ON, any visible **[Create Pair]** button is hidden

#### Rapid Pair Creation Workflow

The ungrouped table search functionality supports an efficient keyboard-driven workflow:

1. **Type** search text to filter participants
2. **Press Enter** to select the filtered participant (works when 1 match found)
3. **Type** next search text to filter remaining participants
4. **Press Enter** to select second participant
5. **Pair is created automatically** (if Auto Pair is ON)
6. **Search field is cleared** and ready for next pairing
7. **Repeat** until all participants are paired

**Example:**

```
Type "john" → Press Enter (selects John Smith)
Type "mary" → Press Enter (selects Mary Jones)
→ Pair created automatically: Smith/Jones added to Alternates
Type "bob" → Press Enter (selects Bob Wilson)
Type "sarah" → Press Enter (selects Sarah Davis)
→ Pair created automatically: Wilson/Davis added to Alternates
...continue until ungrouped table is empty
```

**Search Field Behavior:**

- **No Selection:** Search field visible in LEFT location, filters table as you type
- **Participant(s) Selected:** Search field moves to OVERLAY location (left of action buttons)
- **On Selection:** Previous search is cleared and OVERLAY search field gets focus
- **Search fields sync:** Typing in either search field updates both

---

### 5. Withdrawn Panel

**Purpose:** Displays participants who have withdrawn from the event.

**Visibility:**

- **Before Draw Creation:** Visible and collapsed by default
- **After Draw Creation:** Hidden

**Available Actions - Depends on Event Type:**

#### Singles Events:

- **Move participants** to: Alternates

**Use Case:** Withdrawn singles participants can be moved directly back to Alternates if they rejoin.

#### Doubles Events:

- **Move participants** to: Ungrouped

**Use Case:** Withdrawn individual participants (not pairs) return to the Ungrouped table where they can be paired with other participants.

**Important Distinction:**

- In **Singles**, withdrawn participants can go directly to Alternates (they're ready to play)
- In **Doubles**, withdrawn **individual** participants must go to Ungrouped first (they need to be paired before they can be alternates)
- In **Doubles**, withdrawn **pairs** can be moved to Alternates via the context menu or other entry actions

---

## Singles vs Doubles: Key Differences

### Singles Events

| Feature          | Behavior                                            |
| ---------------- | --------------------------------------------------- |
| Ungrouped Panel  | Hidden (not applicable)                             |
| Participant Type | Individual participants only                        |
| Withdrawn → Move | Directly to Alternates                              |
| Entry Management | Straightforward - move individuals between statuses |

### Doubles Events

| Feature          | Behavior                                                         |
| ---------------- | ---------------------------------------------------------------- |
| Ungrouped Panel  | Visible (before draw creation)                                   |
| Participant Type | Pairs (teams of 2) for entries; Individuals in Ungrouped         |
| Withdrawn → Move | Individuals to Ungrouped (must be paired first)                  |
| Pair Creation    | Manual or automatic via Auto Pair toggle                         |
| Pair Destruction | Available in Alternates panel - breaks pairs back to individuals |
| Entry Management | Two-step process: pair individuals → assign entry status         |

**Workflow Difference:**

- **Singles:** Add participant → Set status (Accepted/Alternate/etc.)
- **Doubles:** Add individuals → Pair them → Set pair status (Accepted/Alternate/etc.)

---

## Common Workflows

### Adding Singles Participants

1. Navigate to event entries
2. Click **[Add entries]** from any panel
3. Select participants from tournament roster
4. Choose entry status (Accepted, Qualifying, or Alternate)
5. Participants appear in the appropriate panel

### Creating Doubles Pairs

#### Method 1: Auto Pair ON (Fast)

1. Ensure **[Auto Pair: ON]** is displayed in Ungrouped panel
2. Click first participant in Ungrouped table
3. Click second participant
4. Pair automatically created and moved to Alternates
5. Repeat for remaining participants

#### Method 2: Auto Pair OFF (Controlled)

1. Click **[Auto Pair: ON]** to toggle to **[Auto Pair: OFF]**
2. Click first participant in Ungrouped table
3. Click second participant
4. Review the selection
5. Click **[Create Pair]** button when ready
6. Pair is created and moved to Alternates
7. Repeat for remaining participants

#### Method 3: Search-Driven (Fastest)

1. Ensure **[Auto Pair: ON]** is displayed
2. Type partial name in search field
3. Press Enter when participant is filtered
4. Type next partial name
5. Press Enter - pair created automatically
6. Search clears, ready for next pair

### Moving Participants Between Statuses

1. Select one or more participants in any panel
2. Click **[Move participants]** button (appears when participants selected)
3. Choose destination status from dropdown
4. Participants are moved to the target panel

### Withdrawing Participants

1. Select participants in Accepted, Qualifying, or Alternates panel
2. Click **[Move participants]**
3. Select **Withdrawn**
4. Participants move to Withdrawn panel

### Reinstating Withdrawn Participants

#### Singles:

1. Expand Withdrawn panel
2. Select withdrawn participant(s)
3. Click **[Move participants]**
4. Select **Alternates**
5. Participants move to Alternates panel

#### Doubles:

1. Expand Withdrawn panel
2. Select withdrawn individual participant(s)
3. Click **[Move participants]**
4. Select **Ungrouped**
5. Individuals move to Ungrouped panel
6. Pair them with other participants
7. Resulting pair appears in Alternates

---

## Search and Filter

### Global Search (Top Control Bar)

- Filters across **all panels** simultaneously
- Type in "Search entries" field
- Press Escape to clear search
- Click X icon to clear search

### Ungrouped Panel Search (Doubles Only)

- **Purpose:** Quickly filter and select participants for pairing
- **Location:** LEFT when no selection; OVERLAY when participants selected
- **Auto-clear:** Search is cleared when participants are selected
- **Auto-focus:** OVERLAY search gets focus when selection occurs
- **Enter key:** Selects filtered participant (when 1 or 2 matches)

---

## Visual States

### Control Bar Locations

- **LEFT:** Primary search and filters
- **CENTER:** Headings and counts
- **RIGHT:** Settings and toggles (e.g., Auto Pair)
- **OVERLAY:** Actions available for selected items (appears when selections made)

### Selection State

- **No Selection:** Normal view with LEFT/CENTER/RIGHT controls visible
- **With Selection:**
  - Control bar background becomes light gray
  - OVERLAY controls appear (search, action buttons)
  - LEFT/CENTER/RIGHT controls are hidden
  - Action buttons show available operations for selected items

---

## Tips and Best Practices

### For Tournament Directors

1. **Add all participants first** before creating pairs (Doubles)
2. **Use search** for rapid pair creation in large draws
3. **Keep Auto Pair ON** for speed, turn OFF if you need to review pairings
4. **Seed participants** before creating draws
5. **Use Alternates** to maintain waitlists
6. **Check Withdrawn panel** before finalizing draws

### For Doubles Events

1. **Check for duplicates** - don't pair the same person twice
2. **Gender requirements** - Mixed events require mixed-gender pairs
3. **Destroy and recreate** - Use "Destroy pairs" if you need to reconfigure
4. **Ungrouped should be empty** before draw creation
5. **Withdrawn individuals** must be re-paired before becoming alternates

### For Singles Events

1. **Direct movement** - Singles participants move directly between all statuses
2. **Simpler workflow** - No pairing step required
3. **Quick alternates** - Withdrawn participants can become alternates immediately

---

## Troubleshooting

### "I can't find the Ungrouped panel"

- Ungrouped only appears for **Doubles events** before draw creation
- Singles events don't have an Ungrouped panel

### "Auto Pair isn't working"

- Check that **[Auto Pair: ON]** is displayed
- Ensure you're selecting exactly 2 participants
- If it says OFF, click the toggle to turn it ON

### "Create Pair button disappeared"

- Button only shows when Auto Pair is OFF and 2 participants are selected
- If Auto Pair is ON, pairs are created automatically (no button needed)

### "I can't move a withdrawn doubles participant to Alternates"

- **Individual participants** in Withdrawn must go to Ungrouped first
- Pair them with another participant
- The **resulting pair** will appear in Alternates
- **Pairs** in Withdrawn can be moved directly to Alternates

### "The search field disappeared when I selected a participant"

- Search field moves to OVERLAY (left of action buttons) when selections are made
- This keeps search accessible even when reviewing selected participants
- Previous search is automatically cleared

### "I can't destroy a pair"

- Destroy pairs button only appears in the **Alternates panel** for Doubles events
- Select the pair(s) you want to destroy
- Click **[Destroy pairs]** from the OVERLAY controls
- Individual participants will appear in the Ungrouped table

---

## Related Documentation

- Tournament Setup Guide
- Draw Creation Guide
- Seeding Guide
- Entry Status Reference
