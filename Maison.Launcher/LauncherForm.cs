using System.Diagnostics;
using System.Net;
using System.Net.Http;
using System.Net.Sockets;

namespace Maison.Launcher;

internal sealed class LauncherForm : Form
{
    private readonly string _appDirectory = Path.Combine(AppContext.BaseDirectory, "app");
    private readonly string _dataDirectory = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "Maison",
        "Butik");
    private readonly TextBox _username = new() { Text = "admin", Width = 180 };
    private readonly TextBox _password = new() { UseSystemPasswordChar = true, Width = 180 };
    private readonly Label _status = new()
    {
        AutoSize = false,
        Height = 48,
        Dock = DockStyle.Fill,
        TextAlign = ContentAlignment.MiddleLeft,
        Text = "Dyqani nuk është nisur."
    };
    private readonly Button _startButton = new() { Text = "Nise dyqanin", AutoSize = true };
    private readonly Button _openButton = new() { Text = "Hape dyqanin", AutoSize = true, Enabled = false };
    private readonly Button _adminButton = new() { Text = "Hape panelin e porosive", AutoSize = true, Enabled = false };
    private readonly Button _stopButton = new() { Text = "Ndalo dyqanin", AutoSize = true, Enabled = false };
    private readonly HttpClient _httpClient = new() { Timeout = TimeSpan.FromSeconds(1) };
    private Process? _serverProcess;
    private string? _baseUrl;

    public LauncherForm()
    {
        Text = "MAISON | Hap dyqanin";
        StartPosition = FormStartPosition.CenterScreen;
        MinimumSize = new Size(560, 390);
        Size = new Size(640, 460);
        Font = new Font("Segoe UI", 10);
        BackColor = Color.White;
        FormBorderStyle = FormBorderStyle.FixedDialog;
        MaximizeBox = false;
        AcceptButton = _startButton;
        KeyPreview = true;

        var title = new Label
        {
            Text = "MAISON",
            AutoSize = true,
            Font = new Font("Georgia", 24, FontStyle.Regular),
            Margin = new Padding(0, 0, 0, 4)
        };
        var subtitle = new Label
        {
            Text = "Hap dyqanin dhe menaxho porositë",
            AutoSize = true,
            ForeColor = Color.FromArgb(95, 95, 95)
        };
        var credentialsTitle = new Label
        {
            Text = "Fjalëkalimi për panelin e administratorit",
            AutoSize = true,
            Font = new Font(Font, FontStyle.Bold),
            Margin = new Padding(0, 18, 0, 8)
        };
        var credentialsHint = new Label
        {
            Text = "Përdoret vetëm nga administratori për t’i parë porositë. Të paktën 12 karaktere.",
            AutoSize = true,
            ForeColor = Color.FromArgb(95, 95, 95),
            MaximumSize = new Size(570, 0)
        };
        var usernameRow = CreateFieldRow("Emri i administratorit", _username);
        var passwordRow = CreateFieldRow("Fjalëkalimi", _password);
        var buttonRow = new FlowLayoutPanel
        {
            AutoSize = true,
            FlowDirection = FlowDirection.LeftToRight,
            WrapContents = true,
            Dock = DockStyle.Fill,
            Margin = new Padding(0, 18, 0, 8)
        };
        buttonRow.Controls.AddRange([_startButton, _openButton, _adminButton, _stopButton]);

        var localNotice = new Label
        {
            Text = "Kjo kopje punon në këtë kompjuter. Për t’ua dhënë klientëve një lidhje interneti, duhen domain dhe hosting.",
            AutoSize = true,
            ForeColor = Color.FromArgb(120, 76, 35),
            MaximumSize = new Size(570, 0),
            Margin = new Padding(0, 12, 0, 0)
        };

        var layout = new TableLayoutPanel
        {
            Dock = DockStyle.Fill,
            Padding = new Padding(26),
            ColumnCount = 1,
            RowCount = 8,
            AutoSize = false
        };
        layout.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
        layout.RowStyles.Add(new RowStyle(SizeType.AutoSize));
        layout.RowStyles.Add(new RowStyle(SizeType.AutoSize));
        layout.RowStyles.Add(new RowStyle(SizeType.AutoSize));
        layout.RowStyles.Add(new RowStyle(SizeType.AutoSize));
        layout.RowStyles.Add(new RowStyle(SizeType.AutoSize));
        layout.RowStyles.Add(new RowStyle(SizeType.AutoSize));
        layout.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
        layout.RowStyles.Add(new RowStyle(SizeType.AutoSize));
        layout.Controls.Add(title, 0, 0);
        layout.Controls.Add(subtitle, 0, 1);
        layout.Controls.Add(credentialsTitle, 0, 2);
        layout.Controls.Add(credentialsHint, 0, 3);
        layout.Controls.Add(usernameRow, 0, 4);
        layout.Controls.Add(passwordRow, 0, 5);
        layout.Controls.Add(_status, 0, 6);
        layout.Controls.Add(buttonRow, 0, 7);
        layout.Controls.Add(localNotice, 0, 8);
        layout.RowCount = 9;
        layout.RowStyles.Add(new RowStyle(SizeType.AutoSize));
        Controls.Add(layout);

        _startButton.Click += async (_, _) => await StartShopAsync();
        _openButton.Click += (_, _) => OpenPage(_baseUrl);
        _adminButton.Click += (_, _) => OpenPage($"{_baseUrl}/admin/porosite");
        _stopButton.Click += (_, _) => StopShop();
        KeyDown += (_, eventArgs) =>
        {
            if (eventArgs.KeyCode != Keys.Enter || !_startButton.Enabled)
                return;

            eventArgs.Handled = true;
            eventArgs.SuppressKeyPress = true;
            _startButton.PerformClick();
        };
        FormClosing += (_, _) => StopShop();
    }

    private static Control CreateFieldRow(string label, Control field)
    {
        var row = new TableLayoutPanel
        {
            AutoSize = true,
            ColumnCount = 2,
            Dock = DockStyle.Fill,
            Margin = new Padding(0, 5, 0, 0)
        };
        row.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 190));
        row.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
        row.Controls.Add(new Label
        {
            Text = label,
            AutoSize = true,
            Anchor = AnchorStyles.Left,
            TextAlign = ContentAlignment.MiddleLeft
        }, 0, 0);
        row.Controls.Add(field, 1, 0);
        return row;
    }

    private async Task StartShopAsync()
    {
        if (_serverProcess is { HasExited: false })
        {
            SetStatus("Dyqani është tashmë aktiv.");
            return;
        }

        if (_password.Text.Length < 12)
        {
            MessageBox.Show(
                this,
                "Vendos një fjalëkalim të administratorit me së paku 12 karaktere.",
                "Fjalëkalim i shkurtër",
                MessageBoxButtons.OK,
                MessageBoxIcon.Warning);
            _password.Focus();
            return;
        }

        var executable = Path.Combine(_appDirectory, "Maison.Api.exe");
        if (!File.Exists(executable) || !File.Exists(Path.Combine(_appDirectory, "wwwroot", "index.html")))
        {
            MessageBox.Show(
                this,
                "Skedarët e dyqanit nuk u gjetën. Sigurohu që ZIP-i të jetë shpaketuar i tëri dhe hape MAISON.exe nga dosja kryesore.",
                "Skedarët mungojnë",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error);
            return;
        }

        _startButton.Enabled = false;
        SetStatus("Po hapet dyqani. Prit pak...");
        try
        {
            Directory.CreateDirectory(_dataDirectory);
            var keysDirectory = Path.Combine(_dataDirectory, "keys");
            Directory.CreateDirectory(keysDirectory);
            var port = FindAvailablePort();
            var startInfo = new ProcessStartInfo(executable)
            {
                WorkingDirectory = _appDirectory,
                UseShellExecute = false,
                CreateNoWindow = true,
                WindowStyle = ProcessWindowStyle.Hidden
            };
            startInfo.Environment["ASPNETCORE_ENVIRONMENT"] = "Production";
            startInfo.Environment["ASPNETCORE_URLS"] = $"http://127.0.0.1:{port}";
            startInfo.Environment["ConnectionStrings__MaisonDb"] =
                $"Data Source={Path.Combine(_dataDirectory, "maison.db")}";
            startInfo.Environment["DataProtection__KeysPath"] = keysDirectory;
            startInfo.Environment["LocalApp__AllowHttpCookies"] = "true";
            startInfo.Environment["ADMIN_USERNAME"] = _username.Text.Trim();
            startInfo.Environment["ADMIN_PASSWORD"] = _password.Text;
            _serverProcess = Process.Start(startInfo)
                ?? throw new InvalidOperationException("Serveri i dyqanit nuk u nis.");
            _baseUrl = $"http://127.0.0.1:{port}";

            for (var attempt = 0; attempt < 40; attempt++)
            {
                if (_serverProcess.HasExited)
                    throw new InvalidOperationException(
                        "Serveri u ndal gjatë nisjes. Kontrollo nëse antivirus-i e bllokoi aplikacionin.");

                try
                {
                    using var response = await _httpClient.GetAsync($"{_baseUrl}/health");
                    if (response.IsSuccessStatusCode)
                    {
                        SetStatus("Dyqani është gati. Faqja u hap në shfletues.");
                        _openButton.Enabled = true;
                        _adminButton.Enabled = true;
                        _stopButton.Enabled = true;
                        OpenPage(_baseUrl);
                        return;
                    }
                }
                catch (HttpRequestException)
                {
                    // The local app needs a short moment to start listening.
                }
                catch (TaskCanceledException)
                {
                    // A single health-check timeout is retried during startup.
                }

                await Task.Delay(350);
            }

            throw new InvalidOperationException(
                "Dyqani nuk u përgjigj në kohë. Provo ta hapësh përsëri.");
        }
        catch (Exception error)
        {
            StopShop();
            SetStatus("Dyqani nuk u nis.");
            MessageBox.Show(
                this,
                error.Message,
                "Nuk u hap dyqani",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error);
        }
        finally
        {
            _startButton.Enabled = true;
        }
    }

    private void StopShop()
    {
        if (_serverProcess is { HasExited: false })
        {
            try
            {
                _serverProcess.Kill(entireProcessTree: true);
                _serverProcess.WaitForExit(5000);
            }
            catch (InvalidOperationException)
            {
                // The process exited between the check and the stop request.
            }
        }

        _serverProcess?.Dispose();
        _serverProcess = null;
        _baseUrl = null;
        _openButton.Enabled = false;
        _adminButton.Enabled = false;
        _stopButton.Enabled = false;
        _password.Clear();
        SetStatus("Dyqani nuk është nisur. Porositë e ruajtura nuk fshihen.");
    }

    private void OpenPage(string? url)
    {
        if (string.IsNullOrWhiteSpace(url))
            return;

        try
        {
            Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
        }
        catch (Exception error)
        {
            MessageBox.Show(
                this,
                $"Nuk munda ta hap shfletuesin automatikisht. Hape këtë adresë: {url}\n\n{error.Message}",
                "Hape faqen",
                MessageBoxButtons.OK,
                MessageBoxIcon.Information);
        }
    }

    private void SetStatus(string message) => _status.Text = message;

    private static int FindAvailablePort()
    {
        using var listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Start();
        return ((IPEndPoint)listener.LocalEndpoint).Port;
    }
}
