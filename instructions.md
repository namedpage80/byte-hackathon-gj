Project Tenents
* Keep refactoring to a minimum
* Avoid unecessary changes
* Use establed patterns existing in the codebase
* This project is a hot-reloading project
* Leverage the existing tailwind styling motif

RecieptPrinter Changes
1. Add a button to all visible elements on the canvas that removes the element from the canvas.
    - The button should appear on the top right of the visible element
    - It should only be visible when hovering over the visible element
    - It should remove the text-element from the canvas when clicked


2. Make nonvisible styling elements visible in the canvas
    - Use a grayed out style to hint it's not a true visible element
    - It should have the same remove button as the visible elements
    - The element on the canvas should be text and briefly describe what it is

3. Refresh the canvas after removal of a non visible element
    - Do a full re-render of the canvas if any non visible element is modified on the canvas
    - For example, if a text-align element is removed, any visible elements below it should render with any existing non visible styling elements above it
    - Keep any unit tests in the project into a folder called tests
