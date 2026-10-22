namespace Maison.Api.Services;

public interface IEmailSender
{
    bool IsConfigured { get; }

    Task SendPasswordResetAsync(
        string recipient,
        string resetUrl,
        CancellationToken cancellationToken);
}
