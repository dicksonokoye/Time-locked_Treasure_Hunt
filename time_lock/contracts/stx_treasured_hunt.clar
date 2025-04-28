;; treasure-hunt.clar
;; A smart contract for an on-chain treasure hunt with time-locked clues and puzzle mechanisms

;; Define data variables
(define-data-var admin principal tx-sender)
(define-data-var hunt-active bool false)
(define-data-var total-stages uint u5)
(define-data-var total-reward uint u0)
(define-data-var current-block-height uint u0) ;; Mock block height

;; Maps to store hunt data
(define-map stages 
  { stage-id: uint } 
  {
    clue: (string-ascii 256),
    answer: (string-ascii 64),
    reward: uint,
    time-lock: uint,
    solved: bool
  }
)

(define-map player-progress 
  { player: principal } 
  { current-stage: uint }
)

(define-map stage-solvers
  { stage-id: uint }
  { solvers: (list 10 principal) }
)

;; Error codes
(define-constant ERR-NOT-AUTHORIZED (err u100))
(define-constant ERR-HUNT-NOT-ACTIVE (err u101))
(define-constant ERR-STAGE-NOT-FOUND (err u102))
(define-constant ERR-INCORRECT-ANSWER (err u103))
(define-constant ERR-TIME-LOCKED (err u104))
(define-constant ERR-ALREADY-SOLVED (err u105))
(define-constant ERR-INSUFFICIENT-FUNDS (err u106))
(define-constant ERR-STAGE-EXISTS (err u107))

;; Admin functions

;; Initialize or reset the hunt
(define-public (initialize-hunt (stages-count uint) (total-hunt-reward uint) (starting-block-height uint))
  (begin
    (asserts! (is-eq tx-sender (var-get admin)) ERR-NOT-AUTHORIZED)
    (asserts! (>= (stx-get-balance tx-sender) total-hunt-reward) ERR-INSUFFICIENT-FUNDS)
    (var-set hunt-active true)
    (var-set total-stages stages-count)
    (var-set total-reward total-hunt-reward)
    (var-set current-block-height starting-block-height)
    (try! (stx-transfer? total-hunt-reward tx-sender (as-contract tx-sender)))
    (ok true)
  )
)

;; Update the mock block height (admin only)
(define-public (update-block-height (new-height uint))
  (begin
    (asserts! (is-eq tx-sender (var-get admin)) ERR-NOT-AUTHORIZED)
    (var-set current-block-height new-height)
    (ok true)
  )
)

;; Add a stage to the hunt
(define-public (add-stage (stage-id uint) (clue (string-ascii 256)) (answer (string-ascii 64)) (reward uint) (time-lock uint))
  (begin
    (asserts! (is-eq tx-sender (var-get admin)) ERR-NOT-AUTHORIZED)
    (asserts! (not (is-some (map-get? stages { stage-id: stage-id }))) ERR-STAGE-EXISTS)
    (map-set stages 
      { stage-id: stage-id } 
      {
        clue: clue,
        answer: answer,
        reward: reward,
        time-lock: time-lock,
        solved: false
      }
    )
    (map-set stage-solvers
      { stage-id: stage-id }
      { solvers: (list) }
    )
    (ok true)
  )
)

;; End the hunt and reclaim any remaining rewards
(define-public (end-hunt)
  (let ((remaining-balance (stx-get-balance (as-contract tx-sender))))
    (asserts! (is-eq tx-sender (var-get admin)) ERR-NOT-AUTHORIZED)
    (var-set hunt-active false)
    (try! (as-contract (stx-transfer? remaining-balance tx-sender (var-get admin))))
    (ok true)
  )
)

;; Player functions

;; Register for the hunt
(define-public (register-for-hunt)
  (begin
    (asserts! (var-get hunt-active) ERR-HUNT-NOT-ACTIVE)
    (map-set player-progress { player: tx-sender } { current-stage: u1 })
    (ok true)
  )
)

;; Get the current clue
(define-public (get-current-clue)
  (let (
    (player-data (default-to { current-stage: u0 } (map-get? player-progress { player: tx-sender })))
    (current-stage (get current-stage player-data))
  )
    (asserts! (var-get hunt-active) ERR-HUNT-NOT-ACTIVE)
    (asserts! (> current-stage u0) ERR-NOT-AUTHORIZED)
    (asserts! (<= current-stage (var-get total-stages)) ERR-STAGE-NOT-FOUND)
    
    (let ((stage-data (unwrap! (map-get? stages { stage-id: current-stage }) ERR-STAGE-NOT-FOUND)))
      ;; Check if the clue is time-locked using our mock block height
      (asserts! (<= (get time-lock stage-data) (var-get current-block-height)) ERR-TIME-LOCKED)
      (ok (get clue stage-data))
    )
  )
)

;; Submit an answer for the current stage
(define-public (submit-answer (answer (string-ascii 64)))
  (let (
    (player-data (default-to { current-stage: u0 } (map-get? player-progress { player: tx-sender })))
    (current-stage (get current-stage player-data))
  )
    (asserts! (var-get hunt-active) ERR-HUNT-NOT-ACTIVE)
    (asserts! (> current-stage u0) ERR-NOT-AUTHORIZED)
    (asserts! (<= current-stage (var-get total-stages)) ERR-STAGE-NOT-FOUND)
    
    (let (
      (stage-data (unwrap! (map-get? stages { stage-id: current-stage }) ERR-STAGE-NOT-FOUND))
      (solvers-data (unwrap! (map-get? stage-solvers { stage-id: current-stage }) ERR-STAGE-NOT-FOUND))
    )
      ;; Check if the clue is time-locked using our mock block height
      (asserts! (<= (get time-lock stage-data) (var-get current-block-height)) ERR-TIME-LOCKED)
      ;; Check if the answer is correct
      (asserts! (is-eq (get answer stage-data) answer) ERR-INCORRECT-ANSWER)
      
      ;; Award the reward
      (try! (as-contract (stx-transfer? (get reward stage-data) (as-contract tx-sender) tx-sender)))
      
      ;; Update player progress to the next stage
      (if (< current-stage (var-get total-stages))
        (map-set player-progress { player: tx-sender } { current-stage: (+ current-stage u1) })
        true
      )
      
      ;; Add player to solvers list if not already solved
      (if (not (get solved stage-data))
        (begin
          ;; Update the stage as solved
          (map-set stages 
            { stage-id: current-stage } 
            (merge stage-data { solved: true })
          )
          ;; Add player to solvers list
          (map-set stage-solvers
            { stage-id: current-stage }
            { solvers: (unwrap! (as-max-len? (append (get solvers solvers-data) tx-sender) u10) ERR-NOT-AUTHORIZED) }
          )
        )
        true
      )
      
      (ok true)
    )
  )
)

;; Read-only functions

;; Get hunt status
(define-read-only (get-hunt-status)
  {
    active: (var-get hunt-active),
    total-stages: (var-get total-stages),
    total-reward: (var-get total-reward),
    current-block-height: (var-get current-block-height)
  }
)

;; Get player progress
(define-read-only (get-player-progress (player principal))
  (default-to { current-stage: u0 } (map-get? player-progress { player: player }))
)

;; Get stage solvers
(define-read-only (get-stage-solvers (stage-id uint))
  (default-to { solvers: (list) } (map-get? stage-solvers { stage-id: stage-id }))
)

;; Check if a stage is time-locked
(define-read-only (is-stage-time-locked (stage-id uint))
  (let ((stage-data (unwrap! (map-get? stages { stage-id: stage-id }) false)))
    ;; Using our mock block height
    (> (get time-lock stage-data) (var-get current-block-height))
  )
)

;; Get admin
(define-read-only (get-admin)
  (var-get admin)
)

;; Get current block height
(define-read-only (get-current-block-height)
  (var-get current-block-height)
)

;; Change admin (only current admin can change)
(define-public (set-admin (new-admin principal))
  (begin
    (asserts! (is-eq tx-sender (var-get admin)) ERR-NOT-AUTHORIZED)
    (var-set admin new-admin)
    (ok true)
  )
)