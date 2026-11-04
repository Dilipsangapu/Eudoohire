package com.euodoo.hire.controller;

import com.euodoo.hire.exception.ResourceNotFoundException;
import com.euodoo.hire.model.Notification;
import com.euodoo.hire.model.User;
import com.euodoo.hire.repository.UserRepository;
import com.euodoo.hire.service.NotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Common REST Controller for notifications across all authenticated roles
 * (Candidates, Recruiters, and Client Admins).
 */
@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
@Slf4j
@PreAuthorize("isAuthenticated()")
public class NotificationController {

    private final NotificationService notificationService;
    private final UserRepository userRepository;

    @GetMapping
    public ResponseEntity<Page<Notification>> getNotifications(
            @AuthenticationPrincipal UserDetails principal,
            @RequestParam(defaultValue = "false") boolean unreadOnly,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        String userId = resolveUserId(principal);
        Pageable pageable = PageRequest.of(Math.max(0, page), Math.min(Math.max(1, size), 50),
                Sort.by("createdAt").descending());
        return ResponseEntity.ok(notificationService.getNotifications(userId, unreadOnly, pageable));
    }

    @GetMapping("/unread-count")
    public ResponseEntity<Map<String, Object>> getUnreadCount(
            @AuthenticationPrincipal UserDetails principal) {
        String userId = resolveUserId(principal);
        long count = notificationService.countUnread(userId);
        return ResponseEntity.ok(Map.of("unreadCount", count, "count", count));
    }

    @PatchMapping("/{id}/read")
    public ResponseEntity<Notification> markAsRead(
            @AuthenticationPrincipal UserDetails principal,
            @PathVariable String id) {
        String userId = resolveUserId(principal);
        return ResponseEntity.ok(notificationService.markAsRead(id, userId));
    }

    @PostMapping("/read-all")
    public ResponseEntity<Map<String, Object>> markAllAsRead(
            @AuthenticationPrincipal UserDetails principal) {
        String userId = resolveUserId(principal);
        int marked = notificationService.markAllAsRead(userId);
        return ResponseEntity.ok(Map.of("success", true, "markedCount", marked));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, Object>> deleteNotification(
            @AuthenticationPrincipal UserDetails principal,
            @PathVariable String id) {
        String userId = resolveUserId(principal);
        notificationService.deleteNotification(id, userId);
        return ResponseEntity.ok(Map.of("success", true, "message", "Notification deleted"));
    }

    private String resolveUserId(UserDetails principal) {
        if (principal == null || principal.getUsername() == null) {
            throw new ResourceNotFoundException("User", "unauthenticated");
        }
        User user = userRepository.findByEmail(principal.getUsername().trim().toLowerCase())
                .orElseThrow(() -> new ResourceNotFoundException("User", principal.getUsername()));
        return user.getId();
    }
}
