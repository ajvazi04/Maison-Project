using System.Net;
using System.Net.Mail;

namespace Maison.Api.Services;

public sealed class SmtpEmailSender(IConfiguration configuration) : IEmailSender
{
    private string? Host => configuration["Email:Smtp:Host"];
    private string? Username => configuration["Email:Smtp:Username"];
    private string? Password => configuration["Email:Smtp:Password"];
    private string? FromAddress => configuration["Email:Smtp:FromAddress"];

    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(Host) &&
        !string.IsNullOrWhiteSpace(FromAddress) &&
        int.TryParse(configuration["Email:Smtp:Port"], out var port) &&
        port is > 0 and <= 65535;

    public async Task SendPasswordResetAsync(
        string recipient,
        string resetUrl,
        CancellationToken cancellationToken)
    {
        if (!IsConfigured)
            throw new InvalidOperationException("SMTP email delivery is not configured.");

        var message = new MailMessage
        {
            From = new MailAddress(
                FromAddress!,
                configuration["Email:Smtp:FromName"] ?? "Maison"),
            Subject = "Rikthimi i fjalëkalimit të llogarisë Maison",
            Body = $"""
                Kërkove të ndryshosh fjalëkalimin e llogarisë Maison.

                Përdor lidhjen më poshtë brenda 60 minutave:
                {resetUrl}

                Nëse nuk e bëre ti këtë kërkesë, shpërfille këtë email.
                """,
            IsBodyHtml = false
        };
        message.To.Add(recipient);

        using var client = new SmtpClient(Host!, int.Parse(configuration["Email:Smtp:Port"]!))
        {
            EnableSsl = !bool.TryParse(configuration["Email:Smtp:EnableSsl"], out var enableSsl) ||
                enableSsl,
            DeliveryMethod = SmtpDeliveryMethod.Network,
            UseDefaultCredentials = false
        };
        if (!string.IsNullOrWhiteSpace(Username))
            client.Credentials = new NetworkCredential(Username, Password);

        await client.SendMailAsync(message, cancellationToken);
    }
}
