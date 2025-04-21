using Microsoft.AspNetCore.Components.Web;
using Microsoft.AspNetCore.Components.WebAssembly.Hosting;
using Microsoft.JSInterop;
using NotUndeserved.Twitch.CustomProgBar;
using NotUndeserved.Twitch.CustomProgBar.Application.Common;
using NotUndeserved.Twitch.CustomProgBar.Application.Interfaces;
using NotUndeserved.Twitch.CustomProgBar.Components.State;
using NotUndeserved.Twitch.CustomProgBar.Services;
using System.Net.Sockets;

var builder = WebAssemblyHostBuilder.CreateDefault(args);
builder.RootComponents.Add<App>("#app");

builder.Services.AddHttpClient();
builder.Services.AddScoped<ProgressState>();
builder.Services.AddScoped<ITokenManagerService, TokenManagerService>();
builder.Services.AddScoped<ITokenRefreshService, TokenRefreshService>();
builder.Services.AddScoped<ITwitchApiClientService, TwitchApiClientService>();

var settings = new AppConfig();
builder.Configuration.Bind(settings);
builder.Services.AddSingleton(settings);

var host = builder.Build();

var configInstance = host.Services.GetRequiredService<AppConfig>();
//var tokenRefresher = host.Services.GetRequiredService<ITokenRefreshService>();
//tokenRefresher.Start();

await host.RunAsync();
await host.Services.GetRequiredService<IJSRuntime>()
    .InvokeVoidAsync("window.setAppConfig", configInstance);
