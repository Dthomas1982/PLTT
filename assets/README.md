Static asset notes for PLTT.

Club badges are stored in assets/badges and resolved centrally by TeamID. The Teams sheet remains the source of team identity and presentation metadata; BadgeURL values are treated as legacy data and are not used as browser-relative filenames.

The badge resolver returns the matching local asset for each TeamID so Safari, Chrome and mobile clients do not depend on external badge hosts.
