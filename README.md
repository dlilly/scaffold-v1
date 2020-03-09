# scaffold
## Motivation
I need a framework with which I can quickly deploy one or more of the following:

* API extension
* Subscription to a CTP message
* UI for the above

In deploying these types of projects, there is usually a fair amount of boilerplate code involved.  Boilerplate code tends to hinder reusability, and code duplication can be an indicator of poor code quality.  Moreover, if we are forced to start completely over for each project that means that extra time is taken during the “duplicated” phases of each.

scaffold provides a framework for easily deploying code without many extra steps. scaffold leverages [ctvault](https://github.com/dlilly/ctvault), which is a wrapper around the JavaScript CTP SDK that abstracts away credential management and uses async/await.

## Tech Stack

* Google Firebase (credential storage)
* node.js with Express

## Features

scaffold will, given a configuration object with the following keys, set up this infrastructure:

* `subscriber` scaffold connects to a Google PubSub topic called 'poc-events'.  Given an event that matches what this subscriber is listening for, it will pass the event to the subscriber to handle.
* `routes` Each route that is exposed here will be mounted under /api/`route.path` and use the provided `route.handler` when a request comes in for the API endpoint.
* `public` scaffold will mount the `route.public` directory under /`route.name` if defined for UI.

## Configuration

scaffold looks by default for its configuration in `config/default.json`.  Right now the following configuration options are available:

| option        | value         |
| ------------- |---------------|
| `port` | port on which to run scaffold |
| `directories` | a list of directories to scan for scaffold config. `#base#` will be replaced by the base directory |
| `pubSubTopic` | the name of the Google PubSub subscription to listen to |
| `ctutils` | path to the ct-utils lib |
