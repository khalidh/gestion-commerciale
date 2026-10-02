$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

$projectPath = Split-Path $PSScriptRoot -Parent
$nodePath = (Get-Command node -ErrorAction Stop).Source
$scriptPath = Join-Path $PSScriptRoot 'manage-user.mjs'

$form = New-Object System.Windows.Forms.Form
$form.Text = 'Gestion commerciale - Compte admin'
$form.ClientSize = New-Object System.Drawing.Size(440, 285)
$form.StartPosition = 'CenterScreen'
$form.FormBorderStyle = 'FixedDialog'
$form.MaximizeBox = $false
$form.MinimizeBox = $false
$form.TopMost = $true
$form.Font = New-Object System.Drawing.Font('Segoe UI', 10)

$accountLabel = New-Object System.Windows.Forms.Label
$accountLabel.Text = 'Identifiant : admin'
$accountLabel.Location = New-Object System.Drawing.Point(24, 20)
$accountLabel.AutoSize = $true
$form.Controls.Add($accountLabel)

$passwordLabel = New-Object System.Windows.Forms.Label
$passwordLabel.Text = 'Nouveau mot de passe (12 caracteres minimum)'
$passwordLabel.Location = New-Object System.Drawing.Point(24, 58)
$passwordLabel.AutoSize = $true
$form.Controls.Add($passwordLabel)

$passwordBox = New-Object System.Windows.Forms.TextBox
$passwordBox.Location = New-Object System.Drawing.Point(24, 86)
$passwordBox.Size = New-Object System.Drawing.Size(392, 28)
$passwordBox.UseSystemPasswordChar = $true
$passwordBox.MaxLength = 1024
$form.Controls.Add($passwordBox)

$confirmationLabel = New-Object System.Windows.Forms.Label
$confirmationLabel.Text = 'Confirmer le mot de passe'
$confirmationLabel.Location = New-Object System.Drawing.Point(24, 128)
$confirmationLabel.AutoSize = $true
$form.Controls.Add($confirmationLabel)

$confirmationBox = New-Object System.Windows.Forms.TextBox
$confirmationBox.Location = New-Object System.Drawing.Point(24, 156)
$confirmationBox.Size = New-Object System.Drawing.Size(392, 28)
$confirmationBox.UseSystemPasswordChar = $true
$confirmationBox.MaxLength = 1024
$form.Controls.Add($confirmationBox)

$saveButton = New-Object System.Windows.Forms.Button
$saveButton.Text = 'Valider'
$saveButton.Location = New-Object System.Drawing.Point(200, 221)
$saveButton.Size = New-Object System.Drawing.Size(104, 34)
$form.Controls.Add($saveButton)
$form.AcceptButton = $saveButton

$cancelButton = New-Object System.Windows.Forms.Button
$cancelButton.Text = 'Annuler'
$cancelButton.Location = New-Object System.Drawing.Point(312, 221)
$cancelButton.Size = New-Object System.Drawing.Size(104, 34)
$cancelButton.DialogResult = [System.Windows.Forms.DialogResult]::Cancel
$form.Controls.Add($cancelButton)
$form.CancelButton = $cancelButton

$saveButton.Add_Click({
    if ($passwordBox.Text.Length -lt 12) {
        [void][System.Windows.Forms.MessageBox]::Show($form, 'Le mot de passe doit contenir au moins 12 caracteres.', 'Saisie invalide')
        return
    }
    if ($passwordBox.Text -cne $confirmationBox.Text) {
        [void][System.Windows.Forms.MessageBox]::Show($form, 'Les deux mots de passe ne correspondent pas.', 'Saisie invalide')
        return
    }
    $saveButton.Enabled = $false
    $form.UseWaitCursor = $true
    $child = $null
    try {
        $startInfo = New-Object System.Diagnostics.ProcessStartInfo
        $startInfo.FileName = $nodePath
        $startInfo.Arguments = '"' + $scriptPath + '" admin APP_ADMIN --stdin-json'
        $startInfo.WorkingDirectory = $projectPath
        $startInfo.UseShellExecute = $false
        $startInfo.CreateNoWindow = $true
        $startInfo.RedirectStandardInput = $true
        $startInfo.RedirectStandardOutput = $true
        $startInfo.RedirectStandardError = $true
        $child = [System.Diagnostics.Process]::Start($startInfo)
        $outputTask = $child.StandardOutput.ReadToEndAsync()
        $errorTask = $child.StandardError.ReadToEndAsync()
        $payload = @{ password = $passwordBox.Text; confirmation = $confirmationBox.Text } | ConvertTo-Json -Compress
        $writer = [System.IO.StreamWriter]::new($child.StandardInput.BaseStream, [System.Text.UTF8Encoding]::new($false))
        $writer.Write($payload)
        $writer.Dispose()
        $payload = $null
        $passwordBox.Clear()
        $confirmationBox.Clear()
        if (-not $child.WaitForExit(30000)) {
            $child.Kill()
            throw 'Delai depasse.'
        }
        if ($child.ExitCode -ne 0) { throw 'Echec de la mise a jour.' }
        [void][System.Windows.Forms.MessageBox]::Show($form, 'Mot de passe enregistre. Connectez-vous avec admin et ce mot de passe.', 'Compte admin pret')
        Write-Host 'Compte admin cree ou actualise; anciennes sessions revoquees.'
        $form.DialogResult = [System.Windows.Forms.DialogResult]::OK
        $form.Close()
    } catch {
        [void][System.Windows.Forms.MessageBox]::Show($form, 'Impossible de mettre a jour le compte. Verifiez que PostgreSQL est disponible, puis reessayez.', 'Erreur')
    } finally {
        if ($child) { $child.Dispose() }
        $saveButton.Enabled = $true
        $form.UseWaitCursor = $false
    }
})

$form.Add_Shown({ $form.Activate(); $passwordBox.Focus() })
Write-Host 'Fenetre de saisie du mot de passe admin ouverte. Saisissez votre secret uniquement dans cette fenetre.'
try {
    $result = $form.ShowDialog()
    if ($result -ne [System.Windows.Forms.DialogResult]::OK) { Write-Host 'Saisie annulee; aucun nouveau mot de passe enregistre par cette fenetre.' }
} finally {
    $passwordBox.Clear()
    $confirmationBox.Clear()
    $form.Dispose()
}