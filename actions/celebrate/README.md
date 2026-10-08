# Member Anniversary Celebration

Members reaching a new anniversary milestone are celebrated.

## Mechanism

When a poll is created, all members are examined to see if any are entering a new year.

- Anniversary date: The group member data does not detail when the member joined the group. We deduce this by checking entire group poll history for the first poll in wich a member voted, and use the poll creation date as their anniversary date.
  - If the current poll is the first poll occurring _past_ the anniversary date, we celebrate. Otherwise, we assume we've handled the celebration after a previous poll creation (within the member's new year).
- Recipients: send 1 message, at-mentioning all recipients, each member on a new line.
- Stats: breakdown the member's yes/no votes, highest yes streak.

## Data

Ideas:

- .gitignore the /celebrate/data files. These should just be manually deployed to your vercel server.
- add timestamp to data JSON files and use this to warn dev when file is outdated (or about to become outdated). Writing to file should update this timestamp (which either lives in the file name or keyed in the JSON).
- only add to existing JSONs, don't completely write over?
