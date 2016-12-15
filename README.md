# Chrome Remote Control
Allows remote control of chrome tabs through web application

## Dependencies
- node js (https://nodejs.org/)
- bower (install via: npm -g install bower)

## Installation

### Server
Go to the **server** folder and run the following commands: 
- install dependencies via: npm install
- edit config.js to enter a password of your choosing
- execute via: node main.js

### Chrome Extension
For now, the chrome extension is not currently published on the store, so you'll need to enable developer mode in the chrome extension section (chrome://extensions/). Check developper mode on the top right.
- install extension by clicking on **Load unpacked extension** and select the **extension** folder of the application

## Web
Go to **client** folder
- install dependencies via: bower install

Once server is **running** and extension is **installed** on the slave chrome window, 
visit http://&lt;machine where server runs&gt;:7070

## Enjoy! :)
