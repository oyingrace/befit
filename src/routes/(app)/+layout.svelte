<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { authClient } from '$lib/auth-client';
	import { toast } from 'svelte-sonner';
	import { Button } from '$lib/components/ui/button';
	import {
		Sidebar,
		SidebarContent,
		SidebarFooter,
		SidebarGroup,
		SidebarGroupContent,
		SidebarGroupLabel,
		SidebarHeader,
		SidebarInset,
		SidebarMenu,
		SidebarMenuButton,
		SidebarMenuItem,
		SidebarProvider,
		SidebarSeparator,
		SidebarTrigger
	} from '$lib/components/ui/sidebar';
	import ModeToggle from '$lib/components/mode-toggle.svelte';

	let { children } = $props();
	const session = authClient.useSession();

	const navItems = [
		{ name: 'Dashboard', href: '/dashboard' },
		{ name: 'My Workouts', href: '/exercise-configs' },
		{ name: 'Live Training', href: '/form-analysis' }
	];

	async function handleSignOut() {
		try {
			await authClient.signOut();
			toast.success('Signed out successfully');
			goto('/login');
		} catch (error) {
			toast.error('Error signing out');
			console.error('Sign out error:', error);
		}
	}

	$effect(() => {
		if (!$session.isPending && !$session.data) {
			toast.info('You need to log in to access this page');
			goto('/login');
		}
	});
</script>

<SidebarProvider>
	<Sidebar>
		<SidebarHeader>
			<SidebarMenu>
				<SidebarMenuItem>
					<SidebarMenuButton size="lg">
						<div
							class="bg-primary text-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg"
						>
							<span class="font-bold">F</span>
						</div>
						<div class="grid flex-1 text-left text-sm leading-tight">
							<span class="truncate font-semibold">BeFit</span>
							<span class="truncate text-xs">AI Fitness Assistant</span>
						</div>
					</SidebarMenuButton>
				</SidebarMenuItem>
			</SidebarMenu>
		</SidebarHeader>

		<SidebarContent>
			<SidebarGroup>
				<SidebarGroupLabel>Navigation</SidebarGroupLabel>
				<SidebarGroupContent>
					<SidebarMenu>
						{#each navItems as item (item.name)}
							<SidebarMenuItem>
								<SidebarMenuButton isActive={page.url.pathname === item.href}>
									<a href={item.href} class="flex w-full items-center">
										<span>{item.name}</span>
									</a>
								</SidebarMenuButton>
							</SidebarMenuItem>
						{/each}
					</SidebarMenu>
				</SidebarGroupContent>
			</SidebarGroup>
		</SidebarContent>

		<SidebarFooter>
			<!-- User Profile Section -->
			{#if $session.data?.user}
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton
							size="lg"
							class="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
						>
							<div
								class="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg"
							>
								<span class="text-sm font-medium">
									{$session.data.user.name?.charAt(0).toUpperCase() ||
										$session.data.user.email?.charAt(0).toUpperCase() ||
										'U'}
								</span>
							</div>
							<div class="grid flex-1 text-left text-sm leading-tight">
								<span class="truncate font-semibold">
									{$session.data.user.name || 'Anonymous User'}
								</span>
								<span class="truncate text-xs">
									{$session.data.user.email || 'Guest'}
								</span>
							</div>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>

				<SidebarSeparator />

				<!-- Sign Out Button -->
				<SidebarMenu>
					<SidebarMenuItem>
						<Button
							variant="outline"
							size="sm"
							onclick={handleSignOut}
							class="w-full justify-start"
						>
							Sign Out
						</Button>
					</SidebarMenuItem>
				</SidebarMenu>
			{/if}

			<SidebarSeparator />

			<!-- Theme Toggle -->
			<SidebarMenu>
				<SidebarMenuItem>
					<div class="flex items-center justify-between px-2 py-1">
						<span class="text-muted-foreground text-sm">Theme</span>
						<ModeToggle />
					</div>
				</SidebarMenuItem>
			</SidebarMenu>

			<SidebarSeparator />

			<!-- Footer Info -->
			<div class="text-muted-foreground px-2 py-1 text-xs">
				<p>© 2026 BeFit</p>
			</div>
		</SidebarFooter>
	</Sidebar>

	<SidebarInset>
		<header class="flex h-16 shrink-0 items-center gap-2 border-b px-4">
			<SidebarTrigger class="-ml-1" />
			<div class="ml-auto">
				<!-- Additional header content can go here -->
			</div>
		</header>

		<div class="flex flex-1 flex-col gap-4 p-4">
			{@render children()}
		</div>
	</SidebarInset>
</SidebarProvider>
