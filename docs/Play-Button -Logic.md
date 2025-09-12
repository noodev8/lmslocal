# Fixture Flow Logic

### "PLAY" BUTTON PRESSED

### NO ROUNDS EXIST
- **NO rounds exist**: Display "waiting for fixtures" screen

### ROUNDS EXIST NO FIXTURES
- **NO fixtures in latest round**: Display "waiting for fixtures" screen

### SHOW PICK SCREEN
### ROUNDS EXIST WITH FIXTURES
- **Lock time NOT reached**:
  - Show player's current pick (if any)
  - Player can change their pick
- **Lock time reached**:
  - Show player's locked pick
  - Show selection pick count badge on each fixture (number of players who selected each team)
  - Player cannot change their pick

