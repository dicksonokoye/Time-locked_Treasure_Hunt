# Treasure Hunt Smart Contract

A decentralized on-chain treasure hunt game built on the Stacks blockchain using Clarity smart contracts. This application creates an interactive puzzle-solving experience where participants solve time-locked clues to earn STX rewards.

## Overview

The Treasure Hunt smart contract provides a framework for creating multi-stage puzzles or riddles where each solution unlocks the next clue and an associated reward. Key features include:

- Multiple puzzle stages with progressive difficulty
- Time-locked clues that reveal at specific block heights
- STX token rewards for solving each stage
- Tracking of player progress and stage completion
- Admin controls for hunt configuration and management

## How It Works

1. The hunt administrator initializes a new treasure hunt with a predefined number of stages and total reward pool
2. The admin adds individual stages, each with a clue, answer, reward amount, and time-lock parameter
3. Players register to participate in the hunt
4. Players solve each clue by submitting the correct answer
5. When correct answers are submitted, players receive STX rewards and advance to the next stage
6. The first player to solve each stage is recorded in the contract

## Contract Functions

### Admin Functions

| Function | Description |
|----------|-------------|
| `initialize-hunt` | Start a new hunt with specified stages and reward pool |
| `add-stage` | Create a new stage with clue, answer, reward, and time-lock |
| `update-block-height` | Update the mock block height (for testing) |
| `end-hunt` | Conclude the hunt and reclaim remaining rewards |
| `set-admin` | Transfer admin privileges to a new address |

### Player Functions

| Function | Description |
|----------|-------------|
| `register-for-hunt` | Join the hunt and start at stage 1 |
| `get-current-clue` | Retrieve the clue for your current stage |
| `submit-answer` | Submit an answer for your current stage |

### Read-Only Functions

| Function | Description |
|----------|-------------|
| `get-hunt-status` | Check if hunt is active and view total stages/rewards |
| `get-player-progress` | View a player's current stage |
| `get-stage-solvers` | See which players have solved a stage |
| `is-stage-time-locked` | Check if a stage is still time-locked |
| `get-admin` | View the current administrator address |
| `get-current-block-height` | Get the current mock block height |

## Error Codes

| Code | Meaning |
|------|---------|
| `ERR-NOT-AUTHORIZED` (u100) | Caller lacks permission for the action |
| `ERR-HUNT-NOT-ACTIVE` (u101) | Treasure hunt is not currently active |
| `ERR-STAGE-NOT-FOUND` (u102) | Referenced stage does not exist |
| `ERR-INCORRECT-ANSWER` (u103) | Submitted answer is incorrect |
| `ERR-TIME-LOCKED` (u104) | Stage is still time-locked |
| `ERR-ALREADY-SOLVED` (u105) | Stage has already been solved |
| `ERR-INSUFFICIENT-FUNDS` (u106) | Admin has insufficient funds for rewards |
| `ERR-STAGE-EXISTS` (u107) | Stage ID already exists |

## Development and Testing

### Requirements

- [Clarinet](https://github.com/hirosystems/clarinet) - Clarity development environment
- [Stacks.js](https://github.com/blockstack/stacks.js) - JavaScript library for Stacks blockchain

### Local Testing

1. Clone the repository
2. Install Clarinet
3. Run tests with `clarinet test`

### Example Usage

```clarity
;; Initialize a 5-stage hunt with 1000 STX reward
(initialize-hunt u5 u1000000000 u100)

;; Add stage 1
(add-stage u1 
  "What has keys but no locks?" 
  "piano" 
  u100000000 
  u105)

;; Register as a player
(contract-call? .treasure-hunt register-for-hunt)

;; Get current clue
(contract-call? .treasure-hunt get-current-clue)

;; Submit an answer
(contract-call? .treasure-hunt submit-answer "piano")
```

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Future Enhancements

- Integration with off-chain oracles for dynamic clues
- Support for non-fungible token (NFT) rewards
- Multi-player collaborative stages
- Hint system with additional cost
- Player leaderboards based on completion time