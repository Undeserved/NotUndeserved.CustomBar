using Microsoft.AspNetCore.Components.Web;
using Microsoft.AspNetCore.Components.WebAssembly.Hosting;
using NotUndeserved.Twitch.CustomProgBar;
using NotUndeserved.Twitch.CustomProgBar.Application.Interfaces;
using NotUndeserved.Twitch.CustomProgBar.Components.State;
using NotUndeserved.Twitch.CustomProgBar.Services;

var builder = WebAssemblyHostBuilder.CreateDefault(args);
builder.RootComponents.Add<App>("#app");

//Widget config
//builder.Services.AddHttpClient<IWidgetConfigService, WidgetConfigService>(client => {
//    client.BaseAddress = new Uri(builder.HostEnvironment.BaseAddress);
//});
//builder.Services.AddSingleton<IWidgetConfigService, WidgetConfigService>();
builder.Services.AddHttpClient();
builder.Services.AddSingleton<ProgressState>();

var host = builder.Build();

//var widgetConfigService = host.Services.GetRequiredService<IWidgetConfigService>();
//await widgetConfigService.LoadConfigurationAsync();

await host.RunAsync();
