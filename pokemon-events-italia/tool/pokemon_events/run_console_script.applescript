-- Drives the user's real, already-authenticated Chrome (not a copy, not
-- CDP - Chrome blocks CDP on the default profile as of recent versions).
-- "execute ... javascript" is a distinct, long-standing AppleScript
-- capability, gated by a one-time manual toggle: Chrome's menu bar ->
-- View -> Developer -> Allow JavaScript from Apple Events.
on run argv
    set targetURL to item 1 of argv
    set jsFilePath to item 2 of argv

    set jsText to read POSIX file jsFilePath as «class utf8»

    tell application "Google Chrome"
        activate
        if (count of windows) = 0 then
            make new window
        end if
        set targetTab to make new tab at end of tabs of front window with properties {URL:targetURL}
        set active tab index of front window to (index of targetTab)

        repeat 60 times
            if not (loading of targetTab) then exit repeat
            delay 0.5
        end repeat

        -- extra settle time for the page's own anti-bot challenge/cookies
        delay 8

        execute targetTab javascript jsText
    end tell
end run
