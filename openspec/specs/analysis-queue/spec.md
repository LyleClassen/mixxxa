# Spec: analysis-queue

## Requirement: Enqueue Tracks For Analysis
The system SHALL allow the user to add tracks to the analysis queue, either as a single track or as every track contained in a playlist, using the aspects currently selected in settings.

### Scenario: Enqueue a single track
- **WHEN** the user chooses to analyze a single track
- **THEN** a queue item for that track is added with the currently selected aspects and a status of queued

### Scenario: Enqueue a whole playlist
- **WHEN** the user chooses to analyze a playlist
- **THEN** one queue item is added for each track in that playlist, using the currently selected aspects

### Scenario: Avoid duplicate queue items
- **WHEN** the user enqueues a track that is already queued or currently running
- **THEN** no duplicate item is created for that track

## Requirement: Background Queue Processing
The system SHALL process queued items in order in the background, dispatching them to available workers up to the configured parallelism, and SHALL report live status and progress for each item.

### Scenario: Items processed in order
- **WHEN** the queue has multiple queued items and a worker becomes free
- **THEN** the next queued item in order is dispatched to that worker

### Scenario: Live progress reporting
- **WHEN** an item changes status, phase, or makes progress
- **THEN** the system notifies the view so the queue display updates its phase label and progress indicator without a manual refresh

### Scenario: Item completion
- **WHEN** an item finishes successfully
- **THEN** its status becomes done and its analyzed values are persisted

### Scenario: Item failure
- **WHEN** an item fails to analyze
- **THEN** its status becomes failed with a reason and processing continues with remaining items

## Requirement: Pause, Resume, and Cancel Controls
The system SHALL provide controls to pause, resume, and cancel the analysis queue.

### Scenario: Pause the queue
- **WHEN** the user pauses the queue
- **THEN** no new items are dispatched while in-flight items are allowed to finish

### Scenario: Resume the queue
- **WHEN** the user resumes a paused queue
- **THEN** dispatching of queued items continues from where it left off

### Scenario: Cancel the queue
- **WHEN** the user cancels the queue
- **THEN** all queued items are removed and any in-flight items are signaled to abort and their results discarded

## Requirement: Edit The Queue
The system SHALL allow the user to remove an individual queued item and to move a queued item up or down in processing order.

### Scenario: Remove a queued item
- **WHEN** the user removes a queued item
- **THEN** that item is taken out of the queue and will not be processed

### Scenario: Reorder a queued item
- **WHEN** the user moves a queued item up or down
- **THEN** the item's position in the processing order changes accordingly

### Scenario: Reordering does not affect running items
- **WHEN** the user attempts to reorder an item that is already running
- **THEN** the running item's execution is unaffected

## Requirement: Queue Persistence Across Restarts
The system SHALL persist the analysis queue so that pending work survives an application restart.

### Scenario: Pending work restored on restart
- **WHEN** the application restarts with items that were queued or running
- **THEN** those items are restored as queued and processing can resume

## Requirement: Analysis History
The system SHALL retain a history of completed and failed analysis runs, including the track, the aspects analyzed, the outcome, and the recorded timings, and SHALL provide a control to prune (clear) the history.

### Scenario: Completed run appended to history
- **WHEN** an analysis run finishes (successfully or with failure)
- **THEN** a history entry is recorded with the track, aspects, outcome, and per-aspect and total timings

### Scenario: History retained until pruned
- **WHEN** the user views the analysis history
- **THEN** prior runs remain available across sessions until explicitly pruned

### Scenario: Prune history
- **WHEN** the user activates the prune control
- **THEN** the analysis history is cleared while the current queue items are unaffected
