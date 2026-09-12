Option Explicit
Dim shell, fs, folder, executable
Set shell = CreateObject("WScript.Shell")
Set fs = CreateObject("Scripting.FileSystemObject")
folder = fs.GetParentFolderName(WScript.ScriptFullName)
executable = folder & "\node_modules\electron\dist\electron.exe"
If Not fs.FileExists(executable) Then
  MsgBox "This local development build is unavailable. Ask the Lane maintainer to restore its runtime.", 48, "Lane"
  WScript.Quit 1
End If
shell.Run Chr(34) & executable & Chr(34) & " " & Chr(34) & folder & Chr(34) & " --diagnostic-run", 0, False
