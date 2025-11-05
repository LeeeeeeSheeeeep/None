#ifndef __CONTACT_NAIVE_H__
#define __CONTACT_NAIVE_H__

#define _CRT_SECURE_NO_WARNINGS 1

#include <stdio.h>
#include <string.h>
#include <stdlib.h>

/*
 ====================================================================================
                        [ 淳朴进阶版 - contact_naive.h ]
                     适合 C 语言初学者到进阶读者的详细声明
 ====================================================================================
 * 
 * 💡 设计思路:
 *    本版本采用"固定大小数组"来管理通讯录. 结构简单直观, 内存开辟在栈区.
 *
 ====================================================================================
 */

#define MAX 100            // 通讯录最大存放人数
#define MAX_NAME 20        // 名字的最大长度
#define MAX_SEX 10         // 性别的最大长度
#define MAX_TELE 15        // 电话的最大长度
#define MAX_ADDR 30        // 地址的最大长度

// 菜单选项枚举
typedef enum Option
{
    EXIT = 0,
    ADD,
    DEL,
    SEARCH,
    MODIFY,
    SHOW,
    SORT
} Option;

// 联系人信息结构体
typedef struct PeoInfo
{
    char name[MAX_NAME];   // 姓名 (字符串)
    int age;               // 年龄 (整型)
    char sex[MAX_SEX];     // 性别 (字符串)
    char tele[MAX_TELE];   // 电话 (字符串)
    char addr[MAX_ADDR];   // 地址 (字符串)
} PeoInfo; 

// 通讯录结构体
typedef struct Contact
{
    PeoInfo data[MAX];     // 存放 100 个联系人数据的数组
    int sz;                // 当前已存放的联系人个数
} Contact;

// 函数声明
void InitContact(Contact* pc);
void AddContact(Contact* pc);
void ShowContact(const Contact* pc); 
void DelContact(Contact* pc);
void SearchContact(const Contact* pc);
void ModifyContact(Contact* pc);
void SortContact(Contact* pc);
void ClearInputBuffer(void);

#endif // __CONTACT_NAIVE_H__
