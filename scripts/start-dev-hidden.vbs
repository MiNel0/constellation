Set fileSystem = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")

projectDirectory = fileSystem.GetParentFolderName(fileSystem.GetParentFolderName(WScript.ScriptFullName))
shell.CurrentDirectory = projectDirectory
shell.Run "cmd.exe /c npm run dev", 0, False
