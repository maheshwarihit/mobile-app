// Display labels for fixed-choice fields whose underlying value is always
// stored as the English enum code (GENDERS/RELATIONSHIPS in @vagewell/shared)
// regardless of UI language — only what's shown on screen changes here.
export const en = {
  "gender.male": "Male",
  "gender.female": "Female",
  "gender.other": "Other",
  "gender.prefer_not_to_say": "Prefer not to say",
  "relationship.spouse": "Spouse",
  "relationship.parent": "Parent",
  "relationship.child": "Child",
  "relationship.sibling": "Sibling",
  "relationship.grandparent": "Grandparent",
  "relationship.grandchild": "Grandchild",
  "relationship.other": "Other",
} as const;

export const ta: Record<keyof typeof en, string> = {
  "gender.male": "ஆண்",
  "gender.female": "பெண்",
  "gender.other": "மற்றவை",
  "gender.prefer_not_to_say": "சொல்ல விரும்பவில்லை",
  "relationship.spouse": "வாழ்க்கைத் துணை",
  "relationship.parent": "பெற்றோர்",
  "relationship.child": "குழந்தை",
  "relationship.sibling": "உடன்பிறப்பு",
  "relationship.grandparent": "தாத்தா/பாட்டி",
  "relationship.grandchild": "பேரக்குழந்தை",
  "relationship.other": "மற்றவை",
};
